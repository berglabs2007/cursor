/**
 * Verifies the tenant-isolation RLS policies against a plain PostgreSQL
 * instance (no Docker needed). Mirrors the assertions in
 * supabase/tests/database/rls_tenant_isolation.test.sql.
 *
 * Usage:
 *   PGHOST=/tmp/berglabs-pg PGPORT=55432 node scripts/rls-verify/verify-rls.mjs
 *
 * On a machine with Docker, prefer `supabase test db` which runs the
 * pgTAP suite against the real Supabase image.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");

const host = process.env.PGHOST ?? "/tmp/berglabs-pg";
const port = Number(process.env.PGPORT ?? "55432");
const dbName = `berglabs_rls_test_${Date.now()}`;

const ORG_A = "a0000000-0000-0000-0000-00000000000a";
const ORG_B = "b0000000-0000-0000-0000-00000000000b";
const USER_A = "11111111-1111-1111-1111-111111111111";
const USER_B = "22222222-2222-2222-2222-222222222222";
const USER_C = "33333333-3333-3333-3333-333333333333";
const LISTING_A = "aaaa1111-0000-0000-0000-000000000001";
const LISTING_B = "bbbb2222-0000-0000-0000-000000000001";

let passed = 0;
let failed = 0;

function report(ok, label, detail = "") {
  if (ok) {
    passed += 1;
    console.log(`  ok - ${label}`);
  } else {
    failed += 1;
    console.error(`  FAIL - ${label}${detail ? ` (${detail})` : ""}`);
  }
}

/** Runs fn inside a transaction impersonating a user via JWT claims. */
async function asUser(client, userId, fn) {
  await client.query("begin");
  try {
    await client.query("set local role authenticated");
    await client.query(
      `select set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub: userId, role: "authenticated" })]
    );
    return await fn(client);
  } finally {
    await client.query("rollback");
  }
}

async function expectDenied(client, sql, label) {
  await client.query("savepoint sp");
  try {
    await client.query(sql);
    report(false, label, "statement unexpectedly succeeded");
  } catch (error) {
    report(error.code === "42501", label, `error code ${error.code}`);
  } finally {
    await client.query("rollback to savepoint sp");
  }
}

async function main() {
  const admin = new pg.Client({ host, port, user: "postgres", database: "postgres" });
  await admin.connect();
  await admin.query(`create database ${dbName}`);
  await admin.end();

  const db = new pg.Client({ host, port, user: "postgres", database: dbName });
  await db.connect();

  console.log("Applying Supabase stub + migrations...");
  await db.query(readFileSync(join(here, "supabase-stub.sql"), "utf8"));
  await db.query(
    readFileSync(join(projectRoot, "supabase/migrations/20260707100000_initial_schema.sql"), "utf8")
  );
  await db.query(
    readFileSync(join(projectRoot, "supabase/migrations/20260707100001_rls_policies.sql"), "utf8")
  );

  console.log("Seeding two organizations...");
  await db.query(`
    insert into public.organizations (id, name) values
      ('${ORG_A}', 'Byrå A'),
      ('${ORG_B}', 'Byrå B');

    insert into auth.users (id, email) values
      ('${USER_A}', 'anna@byra-a.se'),
      ('${USER_B}', 'bengt@byra-b.se'),
      ('${USER_C}', 'carl@byra-a.se');

    insert into public.profiles (id, organization_id, email, full_name, role) values
      ('${USER_A}', '${ORG_A}', 'anna@byra-a.se', 'Anna A', 'owner'),
      ('${USER_B}', '${ORG_B}', 'bengt@byra-b.se', 'Bengt B', 'owner'),
      ('${USER_C}', '${ORG_A}', 'carl@byra-a.se', 'Carl C', 'agent');

    insert into public.listings (id, organization_id, created_by, address) values
      ('${LISTING_A}', '${ORG_A}', '${USER_A}', 'Storgatan 1, Stockholm'),
      ('${LISTING_B}', '${ORG_B}', '${USER_B}', 'Lillgatan 2, Göteborg');

    insert into public.listing_images (listing_id, organization_id, storage_path) values
      ('${LISTING_A}', '${ORG_A}', '${ORG_A}/${LISTING_A}/img1.jpg'),
      ('${LISTING_B}', '${ORG_B}', '${ORG_B}/${LISTING_B}/img1.jpg');
  `);

  console.log("\nUser A (Byrå A, owner):");
  await asUser(db, USER_A, async (c) => {
    const orgs = await c.query("select id from public.organizations");
    report(orgs.rows.length === 1 && orgs.rows[0].id === ORG_A, "sees only their own organization");

    const profiles = await c.query("select id from public.profiles");
    report(
      profiles.rows.length === 2 && profiles.rows.every((r) => [USER_A, USER_C].includes(r.id)),
      "sees only profiles in their own organization"
    );

    const listings = await c.query("select id, address from public.listings");
    report(
      listings.rows.length === 1 && listings.rows[0].address === "Storgatan 1, Stockholm",
      "sees only their own organization's listings"
    );

    const images = await c.query("select id from public.listing_images");
    report(images.rows.length === 1, "sees only their own organization's images");

    await expectDenied(
      c,
      `insert into public.listings (organization_id, created_by, address)
       values ('${ORG_B}', '${USER_A}', 'Intrång 1')`,
      "cannot insert a listing into organization B"
    );

    await expectDenied(
      c,
      `insert into public.listings (organization_id, created_by, address)
       values ('${ORG_A}', '${USER_B}', 'Fel skapare')`,
      "cannot forge created_by as another user"
    );

    const upd = await c.query(
      `update public.listings set address = 'Hackad' where id = '${LISTING_B}'`
    );
    report(upd.rowCount === 0, "update of listing B affects zero rows");

    const del = await c.query(`delete from public.listings where id = '${LISTING_B}'`);
    report(del.rowCount === 0, "delete of listing B affects zero rows");
  });

  console.log("\nUser B (Byrå B, owner):");
  await asUser(db, USER_B, async (c) => {
    const listing = await c.query(
      `select address from public.listings where id = '${LISTING_B}'`
    );
    report(
      listing.rows.length === 1 && listing.rows[0].address === "Lillgatan 2, Göteborg",
      "listing B is intact and unchanged"
    );

    const orgs = await c.query("select id from public.organizations");
    report(orgs.rows.length === 1 && orgs.rows[0].id === ORG_B, "sees only organization B");
  });

  console.log("\nUser C (Byrå A, agent):");
  await asUser(db, USER_C, async (c) => {
    await expectDenied(
      c,
      `update public.profiles set role = 'owner' where id = '${USER_C}'`,
      "cannot escalate their own role to owner"
    );
    await expectDenied(
      c,
      `update public.profiles set role = 'admin' where id = '${USER_C}'`,
      "cannot escalate their own role to admin"
    );

    const invites = await c.query("select id from public.invitations");
    report(invites.rows.length === 0, "cannot read invitations (owner/admin only)");

    // DELETE without a matching policy is silently filtered (0 rows), not an error.
    const del = await c.query(`delete from public.profiles where id = '${USER_A}'`);
    report(del.rowCount === 0, "cannot remove other members");
  });

  console.log("\nAnonymous:");
  await db.query("begin");
  await db.query("set local role anon");
  await db.query(`select set_config('request.jwt.claims', '', true)`);
  try {
    await db.query("select count(*) from public.listings");
    report(false, "anonymous cannot read listings", "unexpectedly succeeded");
  } catch (error) {
    report(error.code === "42501", "anonymous cannot read listings", `error code ${error.code}`);
  }
  await db.query("rollback");

  await db.end();

  const cleanup = new pg.Client({ host, port, user: "postgres", database: "postgres" });
  await cleanup.connect();
  await cleanup.query(`drop database ${dbName}`);
  await cleanup.end();

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("verify-rls failed:", error);
  process.exit(1);
});
