import type { SubscriptionStatus } from "@/lib/database.types";

const ACTIVE_STATUSES = new Set<SubscriptionStatus>(["active", "trialing"]);

export function isActiveSubscription(status: SubscriptionStatus | string): boolean {
  return ACTIVE_STATUSES.has(status as SubscriptionStatus);
}

export const SUBSCRIPTION_LABELS: Record<string, string> = {
  inactive: "Ingen aktiv prenumeration",
  trialing: "Provperiod",
  active: "Aktiv",
  past_due: "Förfallen betalning",
  canceled: "Avslutad",
  incomplete: "Ofullständig",
  incomplete_expired: "Ofullständig (utgången)",
  unpaid: "Obetald",
  paused: "Pausad",
};

export const SEAT_PRICE_SEK = 500;
