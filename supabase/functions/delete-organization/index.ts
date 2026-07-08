/**
 * delete-organization
 *
 * Permanently deletes an organization and all associated data:
 * listing images in Storage, database rows (via cascade), and auth users.
 * Only the organization owner may call this function.
 */
import { AuthError, requireAuth } from "../_shared/auth.ts";
import { errorResponse, handleOptions, jsonResponse } from "../_shared/http.ts";
import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";

interface DeleteRequest {
  confirmation?: string;
}

async function removeOrgStorage(admin: SupabaseClient, organizationId: string): Promise<void> {
  const paths: string[] = [];

  const { data: imageRows } = await admin
    .from("listing_images")
    .select("storage_path")
    .eq("organization_id", organizationId);

  for (const row of imageRows ?? []) {
    if (row.storage_path) {
      paths.push(row.storage_path as string);
    }
  }

  async function walk(prefix: string): Promise<void> {
    const { data, error } = await admin.storage.from("listing-images").list(prefix, {
      limit: 1000,
    });
    if (error || !data) return;

    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) {
        await walk(path);
      } else {
        paths.push(path);
      }
    }
  }

  await walk(organizationId);

  const uniquePaths = [...new Set(paths)];
  if (uniquePaths.length === 0) return;

  const batchSize = 100;
  for (let i = 0; i < uniquePaths.length; i += batchSize) {
    const batch = uniquePaths.slice(i, i + batchSize);
    const { error } = await admin.storage.from("listing-images").remove(batch);
    if (error) {
      console.error("delete-organization: storage remove failed", error);
      throw new Error("Kunde inte radera uppladdade bilder.");
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions();
  if (req.method !== "POST") {
    return errorResponse("Metoden stöds inte.", 405);
  }

  try {
    const ctx = await requireAuth(req);

    if (ctx.role !== "owner") {
      return errorResponse("Endast byråägaren kan radera organisationen.", 403);
    }

    let body: DeleteRequest;
    try {
      body = (await req.json()) as DeleteRequest;
    } catch {
      return errorResponse("Ogiltig förfrågan.", 400);
    }

    const { data: organization, error: orgError } = await ctx.admin
      .from("organizations")
      .select("name")
      .eq("id", ctx.organizationId)
      .single();

    if (orgError || !organization) {
      return errorResponse("Organisationen hittades inte.", 404);
    }

    const confirmation = body.confirmation?.trim() ?? "";
    if (confirmation !== organization.name) {
      return errorResponse("Bekräftelsen matchar inte byråns namn.", 400);
    }

    const { data: profiles, error: profilesError } = await ctx.admin
      .from("profiles")
      .select("id")
      .eq("organization_id", ctx.organizationId);

    if (profilesError) {
      return errorResponse("Kunde inte läsa medarbetare. Försök igen.", 500);
    }

    const userIds = (profiles ?? []).map((profile) => profile.id as string);

    await removeOrgStorage(ctx.admin, ctx.organizationId);

    const { error: deleteOrgError } = await ctx.admin
      .from("organizations")
      .delete()
      .eq("id", ctx.organizationId);

    if (deleteOrgError) {
      console.error("delete-organization: org delete failed", deleteOrgError);
      return errorResponse("Kunde inte radera byrån. Kontakta support.", 500);
    }

    for (const userId of userIds) {
      const { error: deleteUserError } = await ctx.admin.auth.admin.deleteUser(userId);
      if (deleteUserError) {
        console.error(`delete-organization: failed to delete auth user ${userId}`, deleteUserError);
      }
    }

    return jsonResponse({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error.message, error.status);
    }
    if (error instanceof Error && error.message.includes("bilder")) {
      return errorResponse(error.message, 500);
    }
    console.error("delete-organization: unexpected error", error);
    return errorResponse("Något gick fel. Försök igen eller kontakta support.", 500);
  }
});
