/**
 * sync-seats
 *
 * Recalculates the billable seat count (profiles + pending invitations)
 * and updates the Stripe subscription quantity. Called after inviting
 * or removing team members.
 */
import { AuthError, requireAuth } from "../_shared/auth.ts";
import { errorResponse, handleOptions, jsonResponse } from "../_shared/http.ts";
import { countUsedSeats, syncStripeSeatQuantity } from "../_shared/stripe.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions();
  if (req.method !== "POST") return errorResponse("Metoden stöds inte.", 405);

  try {
    const ctx = await requireAuth(req);

    if (ctx.role !== "owner" && ctx.role !== "admin") {
      return errorResponse("Endast ägare och administratörer kan synka platser.", 403);
    }

    const seats = await countUsedSeats(ctx.admin, ctx.organizationId);
    const { synced } = await syncStripeSeatQuantity(ctx.admin, ctx.organizationId, seats);

    return jsonResponse({ seats, synced });
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error.message, error.status);
    }
    console.error("sync-seats: unexpected error", error);
    return errorResponse("Kunde inte uppdatera antal platser hos Stripe. Försök igen.", 500);
  }
});
