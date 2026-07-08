/**
 * stripe-webhook
 *
 * Receives Stripe events and keeps organizations + subscriptions in sync.
 * verify_jwt is disabled – authenticity is verified via Stripe signature.
 */
import Stripe from "npm:stripe@17.7.0";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, errorResponse } from "../_shared/http.ts";
import {
  getStripeClient,
  mapStripeSubscriptionStatus,
  persistSubscriptionState,
} from "../_shared/stripe.ts";

function getAdminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Supabase service role not configured");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function resolveOrganizationId(
  // deno-lint-ignore no-explicit-any
  admin: { from: (table: string) => any },
  metadata: Stripe.Metadata | null | undefined,
  customerId: string | Stripe.Customer | Stripe.DeletedCustomer | null
): Promise<string | null> {
  if (metadata?.organization_id) {
    return metadata.organization_id;
  }

  if (typeof customerId === "string") {
    const { data: org } = await admin
      .from("organizations")
      .select("id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    if (org?.id) return org.id as string;
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return errorResponse("Metoden stöds inte.", 405);
  }

  const stripe = getStripeClient();
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!webhookSecret) {
    console.error("stripe-webhook: STRIPE_WEBHOOK_SECRET not set");
    return errorResponse("Webhook är felkonfigurerad.", 500);
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return errorResponse("Saknar Stripe-signatur.", 400);
  }

  let event: Stripe.Event;
  try {
    const body = await req.text();
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    console.error("stripe-webhook: signature verification failed", error);
    return errorResponse("Ogiltig webhook-signatur.", 400);
  }

  const admin = getAdminClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription" || !session.subscription) break;

        const organizationId = await resolveOrganizationId(
          admin,
          session.metadata,
          session.customer
        );
        if (!organizationId) {
          console.error("stripe-webhook: no organization_id on checkout.session.completed");
          break;
        }

        const subscription = await stripe.subscriptions.retrieve(
          session.subscription as string
        );
        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : (session.customer?.id ?? "");

        await persistSubscriptionState(admin, organizationId, subscription, customerId);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const organizationId = await resolveOrganizationId(
          admin,
          subscription.metadata,
          subscription.customer
        );

        if (!organizationId) {
          console.error(`stripe-webhook: no organization_id on ${event.type}`);
          break;
        }

        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer.id;

        await persistSubscriptionState(admin, organizationId, subscription, customerId);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const organizationId = await resolveOrganizationId(
          admin,
          subscription.metadata,
          subscription.customer
        );

        if (!organizationId) break;

        await admin
          .from("organizations")
          .update({ subscription_status: "canceled", seats_purchased: 0 })
          .eq("id", organizationId);

        await admin
          .from("subscriptions")
          .update({
            status: "canceled",
            cancel_at_period_end: false,
            seats: 0,
          })
          .eq("organization_id", organizationId);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        if (!customerId) break;

        const { data: org } = await admin
          .from("organizations")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (org?.id) {
          await admin
            .from("organizations")
            .update({ subscription_status: "past_due" })
            .eq("id", org.id);
        }
        break;
      }

      default:
        // Unhandled events are acknowledged silently.
        break;
    }
  } catch (error) {
    console.error(`stripe-webhook: handler failed for ${event.type}`, error);
    return errorResponse("Webhook-hanteraren misslyckades.", 500);
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
