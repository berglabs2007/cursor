/**
 * Shared Stripe helpers for BergLabs Edge Functions.
 * Seat-based billing: quantity = active profiles + pending invitations.
 */
import Stripe from "npm:stripe@17.7.0";

export type OrgSubscriptionStatus =
  | "inactive"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid"
  | "paused";

const ACTIVE_STATUSES = new Set<OrgSubscriptionStatus>(["active", "trialing"]);

export function getStripeClient(): Stripe {
  const secretKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  return new Stripe(secretKey, {
    httpClient: Stripe.createFetchHttpClient(),
  });
}

export function getStripePriceId(): string {
  const priceId = Deno.env.get("STRIPE_PRICE_ID");
  if (!priceId) {
    throw new Error("STRIPE_PRICE_ID is not configured");
  }
  return priceId;
}

export function getAppUrl(): string {
  return Deno.env.get("APP_URL") ?? "http://localhost:3000";
}

/** Maps a Stripe subscription status to our organizations.subscription_status. */
export function mapStripeSubscriptionStatus(
  status: Stripe.Subscription.Status
): OrgSubscriptionStatus {
  switch (status) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
      return "canceled";
    case "incomplete":
      return "incomplete";
    case "incomplete_expired":
      return "incomplete_expired";
    case "unpaid":
      return "unpaid";
    case "paused":
      return "paused";
    default:
      return "inactive";
  }
}

export function isActiveSubscriptionStatus(status: string): boolean {
  return ACTIVE_STATUSES.has(status as OrgSubscriptionStatus);
}

/** Active profiles + pending invitations = seats billed. */
export async function countUsedSeats(
  // deno-lint-ignore no-explicit-any
  admin: { from: (table: string) => any },
  organizationId: string
): Promise<number> {
  const [{ count: profileCount }, { count: inviteCount }] = await Promise.all([
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId),
    admin
      .from("invitations")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "pending"),
  ]);

  return (profileCount ?? 0) + (inviteCount ?? 0);
}

/**
 * Updates the Stripe subscription quantity to match the current seat
 * count (minimum 1). Returns false when no subscription exists yet.
 */
export async function syncStripeSeatQuantity(
  // deno-lint-ignore no-explicit-any
  admin: { from: (table: string) => any },
  organizationId: string,
  targetSeats?: number
): Promise<{ seats: number; synced: boolean }> {
  const seats = Math.max(1, targetSeats ?? (await countUsedSeats(admin, organizationId)));

  const { data: subscription } = await admin
    .from("subscriptions")
    .select("stripe_subscription_id")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!subscription?.stripe_subscription_id) {
    return { seats, synced: false };
  }

  const stripe = getStripeClient();
  const stripeSub = await stripe.subscriptions.retrieve(
    subscription.stripe_subscription_id as string
  );

  const item = stripeSub.items.data[0];
  if (!item?.id) {
    throw new Error("subscription has no line items");
  }

  if (item.quantity === seats) {
    return { seats, synced: true };
  }

  await stripe.subscriptions.update(subscription.stripe_subscription_id as string, {
    items: [{ id: item.id, quantity: seats }],
    proration_behavior: "create_prorations",
  });

  return { seats, synced: true };
}

/** Persists Stripe subscription state to organizations + subscriptions. */
export async function persistSubscriptionState(
  // deno-lint-ignore no-explicit-any
  admin: { from: (table: string) => any },
  organizationId: string,
  stripeSubscription: Stripe.Subscription,
  stripeCustomerId: string
): Promise<void> {
  const status = mapStripeSubscriptionStatus(stripeSubscription.status);
  const seats = stripeSubscription.items.data[0]?.quantity ?? 1;
  const periodEnd = stripeSubscription.current_period_end
    ? new Date(stripeSubscription.current_period_end * 1000).toISOString()
    : null;

  await admin
    .from("organizations")
    .update({
      stripe_customer_id: stripeCustomerId,
      subscription_status: status,
      seats_purchased: seats,
    })
    .eq("id", organizationId);

  await admin.from("subscriptions").upsert(
    {
      organization_id: organizationId,
      stripe_subscription_id: stripeSubscription.id,
      plan: "per_seat",
      seats,
      status,
      current_period_end: periodEnd,
      cancel_at_period_end: stripeSubscription.cancel_at_period_end,
    },
    { onConflict: "organization_id" }
  );
}
