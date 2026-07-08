/**
 * End-to-end smoke test against a real Supabase project.
 *
 * Flow: create a confirmed test user (organization signup trigger) ->
 * sign in -> create a listing -> stream generation from the
 * generate-listing Edge Function -> verify persistence -> clean up.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     node scripts/e2e-smoke.mjs
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const TEST_EMAIL = `e2e-smoke-${Date.now()}@example.com`;
const TEST_PASSWORD = `Smoke-${crypto.randomUUID()}`;

async function api(path, options = {}, key = SERVICE_KEY) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${options.token ?? key}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: response.status, body };
}

function assert(condition, label, detail = "") {
  if (condition) {
    console.log(`  ok - ${label}`);
  } else {
    console.error(`  FAIL - ${label}${detail ? `: ${detail}` : ""}`);
    process.exitCode = 1;
    throw new Error(label);
  }
}

let userId = null;
let organizationId = null;

async function cleanup() {
  if (organizationId) {
    // Cascades to profiles/listings/images/versions via FKs.
    await api(`/rest/v1/organizations?id=eq.${organizationId}`, { method: "DELETE" });
  }
  if (userId) {
    await api(`/auth/v1/admin/users/${userId}`, { method: "DELETE" });
  }
  console.log("\nCleanup done (test org + user removed).");
}

try {
  console.log("1. Creating confirmed test user with organization metadata...");
  const created = await api("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: {
        organization_name: "E2E Smoke Byrå AB",
        full_name: "Test Testsson",
      },
    }),
  });
  assert(created.status === 200, "admin user created", JSON.stringify(created.body));
  userId = created.body.id;

  console.log("2. Signing in with email/password...");
  const login = await api(
    "/auth/v1/token?grant_type=password",
    {
      method: "POST",
      body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    },
    ANON_KEY
  );
  assert(login.status === 200 && login.body.access_token, "signed in");
  const token = login.body.access_token;

  console.log("3. Reading profile created by the signup trigger...");
  const profile = await api(
    `/rest/v1/profiles?select=organization_id,role&id=eq.${userId}`,
    { token },
    ANON_KEY
  );
  assert(
    profile.status === 200 && profile.body.length === 1 && profile.body[0].role === "owner",
    "owner profile exists",
    JSON.stringify(profile.body)
  );
  organizationId = profile.body[0].organization_id;

  console.log("4. Creating a listing via PostgREST (RLS-protected)...");
  const listing = await api(
    "/rest/v1/listings",
    {
      method: "POST",
      token,
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        organization_id: organizationId,
        created_by: userId,
        address: "Fyrverkarbacken 21, Stockholm",
        property_type: "apartment",
        rooms: 3,
        area_sqm: 78,
        price: 5450000,
        monthly_fee: 3890,
        build_year: 1962,
        key_features:
          "Nyrenoverat kök 2023, balkong i söderläge med fri utsikt över Riddarfjärden, 200 m till pendeltåg, öppen spis i vardagsrummet",
        tone: "classic",
      }),
    },
    ANON_KEY
  );
  assert(listing.status === 201, "listing created", JSON.stringify(listing.body));
  const listingId = listing.body[0].id;

  console.log("5. Streaming generation from generate-listing (this calls Claude)...");
  const started = Date.now();
  const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-listing`, {
    method: "POST",
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ listing_id: listingId, part: "all" }),
  });
  assert(response.ok && response.body, "edge function responded", `status ${response.status}`);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let deltaCount = 0;
  let doneEvent = null;
  let errorEvent = null;
  const partsSeen = new Set();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const event = JSON.parse(line.slice(6));
      if (event.type === "delta") deltaCount += 1;
      if (event.type === "part_done") partsSeen.add(event.part);
      if (event.type === "done") doneEvent = event;
      if (event.type === "error") errorEvent = event;
    }
  }

  assert(!errorEvent, "no error event", errorEvent?.message);
  assert(deltaCount > 10, `streaming worked (${deltaCount} deltas)`);
  assert(
    partsSeen.has("headline") && partsSeen.has("body") && partsSeen.has("facts"),
    "all three parts generated"
  );
  assert(doneEvent !== null, "done event received");
  console.log(`  (generation took ${((Date.now() - started) / 1000).toFixed(1)}s)`);

  const { headline, body, facts } = doneEvent.generated_text;
  const wordCount = body.trim().split(/\s+/).length;
  assert(headline.length > 0 && headline.length <= 80, `headline ok (${headline.length} chars)`);
  assert(wordCount >= 120 && wordCount <= 350, `body length ok (${wordCount} words)`);
  assert(facts.includes("•"), "facts is a bullet list");

  console.log("6. Verifying persistence...");
  const persisted = await api(
    `/rest/v1/listings?select=generated_text&id=eq.${listingId}`,
    { token },
    ANON_KEY
  );
  assert(
    persisted.body[0]?.generated_text?.headline === headline,
    "generated text persisted to the listing"
  );

  console.log("\n--- Generated headline ---");
  console.log(headline);
  console.log("\n--- Generated body (first 400 chars) ---");
  console.log(body.slice(0, 400) + (body.length > 400 ? "…" : ""));
  console.log("\n--- Generated facts ---");
  console.log(facts);
  console.log("\nAll smoke tests passed.");
} finally {
  await cleanup();
}
