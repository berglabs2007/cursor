import type { Metadata } from "next";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BillingInfo } from "@/components/billing/billing-info";
import { DeleteOrganizationPanel } from "@/components/settings/delete-organization-panel";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Inställningar",
};

export default async function SettingsPage() {
  const { profile, organization } = await requireSession();
  const supabase = await createClient();

  const [{ count: profileCount }, { count: inviteCount }] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
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
        <p className="text-sm text-muted-foreground">Byråns uppgifter och fakturering.</p>
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

      <BillingInfo usedSeats={usedSeats} seatsPurchased={organization.seats_purchased} />

      {profile.role === "owner" ? (
        <DeleteOrganizationPanel organizationName={organization.name} />
      ) : null}
    </div>
  );
}
