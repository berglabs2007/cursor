/**
 * create-checkout
 *
 * Starts a Stripe Checkout session for seat-based subscription billing.
 * Quantity is set to the current number of seats (profiles + pending invites),
 * minimum 1.
 */
import { AuthError, requireAuth } from "../_shared/auth.ts";
import { errorResponse, handleOptions, jsonResponse } from "../_shared/http.ts";
import {
  countUsedSeats,
  getAppUrl,
  getStripeClient,
  getStripePriceId,
} from "../_shared/stripe.ts";

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
      .select("id, name, stripe_customer_id, subscription_status")
      .eq("id", ctx.organizationId)
      .maybeSingle();

    if (orgError || !organization) {
      return errorResponse("Kunde inte läsa byråns uppgifter. Försök igen.", 500);
    }

    const stripe = getStripeClient();
    const priceId = getStripePriceId();
    const appUrl = getAppUrl();
    const seatCount = Math.max(1, await countUsedSeats(ctx.admin, ctx.organizationId));

    let customerId = organization.stripe_customer_id as string | null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: ctx.email,
        name: organization.name as string,
        metadata: { organization_id: ctx.organizationId },
      });
      customerId = customer.id;

      await ctx.admin
        .from("organizations")
        .update({ stripe_customer_id: customerId })
        .eq("id", ctx.organizationId);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: seatCount }],
      success_url: `${appUrl}/installningar?checkout=success`,
      cancel_url: `${appUrl}/installningar?checkout=cancelled`,
      metadata: { organization_id: ctx.organizationId },
      subscription_data: {
        metadata: { organization_id: ctx.organizationId },
      },
      allow_promotion_codes: true,
      billing_address_collection: "required",
      customer_update: { address: "auto", name: "auto" },
    });

    if (!session.url) {
      return errorResponse("Kunde inte starta betalningen. Försök igen.", 500);
    }

    return jsonResponse({ url: session.url });
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error.message, error.status);
    }
    console.error("create-checkout: unexpected error", error);
    return errorResponse("Kunde inte starta betalningen. Försök igen om en stund.", 500);
  }
});
