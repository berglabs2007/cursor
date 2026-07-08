"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { COOKIE_CONSENT_KEY } from "@/lib/site";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(COOKIE_CONSENT_KEY);
      if (!stored) {
        setVisible(true);
      }
    } catch {
      setVisible(true);
    }
  }, []);

  function accept() {
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
    } catch {
      // If storage is blocked, hide the banner for this session anyway.
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-description"
      className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 p-4 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1 text-sm">
          <p id="cookie-consent-title" className="font-medium text-foreground">
            Cookies och integritet
          </p>
          <p id="cookie-consent-description" className="text-muted-foreground">
            BergLabs använder nödvändiga cookies för inloggning och säkerhet. Vi använder
            inte cookies för marknadsföring eller spårning. Läs mer i vår{" "}
            <Link href="/integritetspolicy" className="underline underline-offset-4">
              integritetspolicy
            </Link>
            .
          </p>
        </div>
        <Button onClick={accept} className="shrink-0">
          Jag förstår
        </Button>
      </div>
    </div>
  );
}
