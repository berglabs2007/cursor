import { Suspense } from "react";
import type { Metadata } from "next";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SubscriptionPanel } from "@/components/billing/subscription-panel";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Inställningar",
};

interface SettingsPageProps {
  searchParams: Promise<{ starta?: string }>;
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const { profile, organization } = await requireSession();
  const { starta } = await searchParams;
  const supabase = await createClient();

  const [{ data: subscription }, { count: profileCount }, { count: inviteCount }] =
    await Promise.all([
      supabase.from("subscriptions").select("*").maybeSingle(),
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("invitations")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
    ]);

  const usedSeats = (profileCount ?? 0) + (inviteCount ?? 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inställningar</h1>
        <p className="text-sm text-muted-foreground">
          Byråns uppgifter och prenumeration.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Byrå</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Namn</span>
            <span className="font-medium">{organization.name}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Organisationsnummer</span>
            <span className="font-medium">{organization.org_number ?? "–"}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Din roll</span>
            <span className="font-medium">
              {profile.role === "owner"
                ? "Ägare"
                : profile.role === "admin"
                  ? "Administratör"
                  : "Mäklare"}
            </span>
          </div>
        </CardContent>
      </Card>

      <Suspense>
        <SubscriptionPanel
          role={profile.role}
          subscriptionStatus={organization.subscription_status}
          seatsPurchased={organization.seats_purchased}
          usedSeats={usedSeats}
          subscription={subscription}
          autoStartCheckout={starta === "1"}
        />
      </Suspense>
    </div>
  );
}
