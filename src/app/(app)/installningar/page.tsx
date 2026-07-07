import type { Metadata } from "next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireSession } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Inställningar",
};

const SUBSCRIPTION_LABELS: Record<string, string> = {
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

export default async function SettingsPage() {
  const { profile, organization } = await requireSession();

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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Prenumeration</CardTitle>
          <CardDescription>
            500 kr per mäklare och månad, inklusive moms. Betalningshantering kopplas in
            under steg 7 (Stripe).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Status</span>
            <Badge
              variant={organization.subscription_status === "active" ? "default" : "secondary"}
            >
              {SUBSCRIPTION_LABELS[organization.subscription_status] ??
                organization.subscription_status}
            </Badge>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Betalda platser</span>
            <span className="font-medium">{organization.seats_purchased}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
