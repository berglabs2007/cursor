"use client";

import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { isActiveSubscription } from "@/lib/subscription";
import type { SubscriptionStatus, UserRole } from "@/lib/database.types";

interface SubscriptionBannerProps {
  subscriptionStatus: SubscriptionStatus;
  role: UserRole;
}

export function SubscriptionBanner({ subscriptionStatus, role }: SubscriptionBannerProps) {
  if (isActiveSubscription(subscriptionStatus)) return null;

  const canManage = role === "owner" || role === "admin";

  return (
    <Alert variant="destructive" className="rounded-none border-x-0 border-t-0">
      <AlertCircle className="size-4" />
      <AlertTitle>Ingen aktiv prenumeration</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
        <span>
          {canManage
            ? "Starta er prenumeration för att generera annonstext, analysera bilder och exportera."
            : "Er byrå behöver en aktiv prenumeration. Kontakta er administratör."}
        </span>
        {canManage ? (
          <Button asChild size="sm" variant="outline" className="shrink-0 bg-background">
            <Link href="/installningar?starta=1">Gå till betalning</Link>
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
