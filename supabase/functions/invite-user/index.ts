/**
 * invite-user
 *
 * Invites an agent to the caller's organization:
 *  1. Validates that the caller is owner/admin.
 *  2. Records the invitation in public.invitations.
 *  3. Sends a Supabase invite email with organization metadata that the
 *     handle_new_user() trigger uses to attach the profile.
 *
 * Seat billing note: adding members affects Stripe subscription quantity –
 * that sync happens in this function when a Stripe subscription exists.
 */
import { AuthError, requireAuth } from "../_shared/auth.ts";
import { errorResponse, handleOptions, jsonResponse } from "../_shared/http.ts";
import { syncStripeSeatQuantity, countUsedSeats } from "../_shared/stripe.ts";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface InviteRequest {
  email?: string;
  role?: string;
  full_name?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions();
  if (req.method !== "POST") {
    return errorResponse("Metoden stöds inte.", 405);
  }

  try {
    const ctx = await requireAuth(req);

    if (ctx.role !== "owner" && ctx.role !== "admin") {
      return errorResponse("Endast ägare och administratörer kan bjuda in medarbetare.", 403);
    }

    let body: InviteRequest;
    try {
      body = (await req.json()) as InviteRequest;
    } catch {
      return errorResponse("Ogiltig förfrågan.", 400);
    }

    const email = body.email?.trim().toLowerCase() ?? "";
    const role = body.role === "admin" ? "admin" : "agent";
    const fullName = body.full_name?.trim() ?? "";

    if (!EMAIL_PATTERN.test(email)) {
      return errorResponse("Ange en giltig e-postadress.", 400);
    }

    // Refuse if the address already belongs to a profile in any organization.
    const { data: existingProfile } = await ctx.admin
      .from("profiles")
      .select("id, organization_id")
      .ilike("email", email)
      .maybeSingle();

    if (existingProfile) {
      return errorResponse(
        existingProfile.organization_id === ctx.organizationId
          ? "Personen är redan medlem i er byrå."
          : "E-postadressen används redan av ett annat konto.",
        409
      );
    }

    // Upsert the invitation (re-inviting a revoked/pending address is allowed).
    const { error: inviteRowError } = await ctx.admin
      .from("invitations")
      .upsert(
        {
          organization_id: ctx.organizationId,
          email,
          role,
          invited_by: ctx.userId,
          status: "pending",
          accepted_at: null,
        },
        { onConflict: "organization_id,email" }
      );

    if (inviteRowError) {
      console.error("invite-user: failed to record invitation", inviteRowError);
      return errorResponse("Kunde inte spara inbjudan. Försök igen.", 500);
    }

    const seatCount = await countUsedSeats(ctx.admin, ctx.organizationId);

    try {
      await syncStripeSeatQuantity(ctx.admin, ctx.organizationId, seatCount);
    } catch (syncError) {
      console.error("invite-user: seat sync failed", syncError);
      await ctx.admin
        .from("invitations")
        .delete()
        .eq("organization_id", ctx.organizationId)
        .eq("email", email);
      return errorResponse(
        "Platserna kunde inte uppdateras hos Stripe. Kontrollera er prenumeration och försök igen.",
        402
      );
    }

    const appUrl = Deno.env.get("APP_URL") ?? "http://localhost:3000";
    const { error: inviteError } = await ctx.admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${appUrl}/auth/confirm`,
      data: {
        organization_id: ctx.organizationId,
        role,
        full_name: fullName,
      },
    });

    if (inviteError) {
      await ctx.admin
        .from("invitations")
        .delete()
        .eq("organization_id", ctx.organizationId)
        .eq("email", email);
      await syncStripeSeatQuantity(ctx.admin, ctx.organizationId).catch(() => undefined);

      if (inviteError.code === "email_exists") {
        return errorResponse("E-postadressen används redan av ett annat konto.", 409);
      }
      console.error("invite-user: inviteUserByEmail failed", inviteError);
      return errorResponse("Kunde inte skicka inbjudan. Försök igen om en stund.", 500);
    }

    return jsonResponse({ success: true, email, role });
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error.message, error.status);
    }
    console.error("invite-user: unexpected error", error);
    return errorResponse("Något gick fel. Försök igen om en stund.", 500);
  }
});
