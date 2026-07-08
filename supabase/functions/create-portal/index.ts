/**
 * create-portal
 *
 * Opens the Stripe Customer Portal so owners/admins can manage payment
 * methods, invoices and subscription cancellation.
 */
import { AuthError, requireAuth } from "../_shared/auth.ts";
import { errorResponse, handleOptions, jsonResponse } from "../_shared/http.ts";
import { getAppUrl, getStripeClient } from "../_shared/stripe.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions();
  if (req.method !== "POST") return errorResponse("Metoden stöds inte.", 405);

  try {
    const ctx = await requireAuth(req);

    if (ctx.role !== "owner" && ctx.role !== "admin") {
      return errorResponse("Endast ägare och administratörer kan hantera betalning.", 403);
    }

    const { data: organization, error: orgError } = await ctx.admin
      .from("organizations")
      .select("stripe_customer_id")
      .eq("id", ctx.organizationId)
      .maybeSingle();

    if (orgError || !organization) {
      return errorResponse("Kunde inte läsa byråns uppgifter. Försök igen.", 500);
    }

    const customerId = organization.stripe_customer_id as string | null;
    if (!customerId) {
      return errorResponse(
        "Ingen Stripe-kund hittades. Starta en prenumeration först.",
        400
      );
    }

    const stripe = getStripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${getAppUrl()}/installningar`,
    });

    return jsonResponse({ url: session.url });
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error.message, error.status);
    }
    console.error("create-portal: unexpected error", error);
    return errorResponse("Kunde inte öppna betalningsportalen. Försök igen.", 500);
  }
});
