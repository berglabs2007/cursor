import type { AuthContext } from "./auth.ts";
import { isActiveSubscriptionStatus } from "./stripe.ts";

export class SubscriptionError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "SubscriptionError";
    this.status = status;
  }
}

/**
 * Blocks AI/export features when the organization has no active subscription.
 * Called server-side in Edge Functions – never trust the client.
 */
export async function requireActiveSubscription(ctx: AuthContext): Promise<void> {
  const { data: organization, error } = await ctx.admin
    .from("organizations")
    .select("subscription_status")
    .eq("id", ctx.organizationId)
    .maybeSingle();

  if (error || !organization) {
    throw new SubscriptionError("Kunde inte läsa prenumerationsstatus. Försök igen.", 500);
  }

  if (!isActiveSubscriptionStatus(organization.subscription_status as string)) {
    throw new SubscriptionError(
      "Er byrå behöver en aktiv prenumeration för att använda denna funktion. Gå till Inställningar för att starta eller förnya er prenumeration.",
      402
    );
  }
}
