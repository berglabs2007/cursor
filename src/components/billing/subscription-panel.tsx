"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CreditCard, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { callEdgeFunction, EdgeFunctionError } from "@/lib/edge-functions";
import {
  isActiveSubscription,
  SEAT_PRICE_SEK,
  SUBSCRIPTION_LABELS,
} from "@/lib/subscription";
import type { Subscription, SubscriptionStatus, UserRole } from "@/lib/database.types";

interface CheckoutResponse {
  url: string;
}

interface SubscriptionPanelProps {
  role: UserRole;
  subscriptionStatus: SubscriptionStatus;
  seatsPurchased: number;
  usedSeats: number;
  subscription: Subscription | null;
  autoStartCheckout?: boolean;
}

function formatPeriodEnd(value: string | null): string {
  if (!value) return "–";
  return new Date(value).toLocaleDateString("sv-SE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function SubscriptionPanel({
  role,
  subscriptionStatus,
  seatsPurchased,
  usedSeats,
  subscription,
  autoStartCheckout = false,
}: SubscriptionPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoadingCheckout, setIsLoadingCheckout] = useState(false);
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);

  const canManageBilling = role === "owner" || role === "admin";
  const isActive = isActiveSubscription(subscriptionStatus);

  useEffect(() => {
    const checkout = searchParams.get("checkout");
    if (checkout === "success") {
      toast.success("Tack! Er prenumeration aktiveras inom några sekunder.");
      router.replace("/installningar");
      router.refresh();
    } else if (checkout === "cancelled") {
      toast.message("Betalningen avbröts. Ni kan starta den igen när ni vill.");
      router.replace("/installningar");
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (autoStartCheckout && canManageBilling && !isActive) {
      void startCheckout();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStartCheckout]);

  async function startCheckout() {
    setIsLoadingCheckout(true);
    try {
      const { url } = await callEdgeFunction<CheckoutResponse>("create-checkout", {});
      window.location.href = url;
    } catch (error) {
      toast.error(
        error instanceof EdgeFunctionError
          ? error.message
          : "Kunde inte starta betalningen. Försök igen."
      );
      setIsLoadingCheckout(false);
    }
  }

  async function openPortal() {
    setIsLoadingPortal(true);
    try {
      const { url } = await callEdgeFunction<CheckoutResponse>("create-portal", {});
      window.location.href = url;
    } catch (error) {
      toast.error(
        error instanceof EdgeFunctionError
          ? error.message
          : "Kunde inte öppna betalningsportalen. Försök igen."
      );
      setIsLoadingPortal(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Prenumeration</CardTitle>
        <CardDescription>
          {SEAT_PRICE_SEK} kr per mäklare och månad, inklusive moms. Fakturering sker per
          aktiv plats (mäklare + väntande inbjudningar).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Status</span>
          <Badge variant={isActive ? "default" : "secondary"}>
            {SUBSCRIPTION_LABELS[subscriptionStatus] ?? subscriptionStatus}
          </Badge>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Använda platser</span>
          <span className="font-medium">
            {usedSeats} av {seatsPurchased > 0 ? seatsPurchased : "–"} betalda
          </span>
        </div>
        {subscription?.current_period_end ? (
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Nästa förnyelse</span>
            <span className="font-medium">{formatPeriodEnd(subscription.current_period_end)}</span>
          </div>
        ) : null}
        {subscription?.cancel_at_period_end ? (
          <p className="text-xs text-muted-foreground">
            Prenumerationen avslutas vid periodens slut.
          </p>
        ) : null}

        {canManageBilling ? (
          <div className="flex flex-wrap gap-2 pt-2">
            {!isActive ? (
              <Button onClick={startCheckout} disabled={isLoadingCheckout}>
                <CreditCard className="size-4" />
                {isLoadingCheckout ? "Öppnar betalning…" : "Starta prenumeration"}
              </Button>
            ) : (
              <Button variant="outline" onClick={openPortal} disabled={isLoadingPortal}>
                <ExternalLink className="size-4" />
                {isLoadingPortal ? "Öppnar…" : "Mina betalningsuppgifter"}
              </Button>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Kontakta er byrås ägare eller administratör för att hantera prenumerationen.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
