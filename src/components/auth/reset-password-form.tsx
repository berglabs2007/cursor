"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export function ResetPasswordForm() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/confirm?next=/uppdatera-losenord`,
    });

    setIsLoading(false);

    if (error) {
      toast.error("Det gick inte att skicka återställningslänken. Försök igen.");
      return;
    }

    setIsSent(true);
  }

  if (isSent) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-muted-foreground">
          Om det finns ett konto för <span className="font-medium text-foreground">{email}</span>{" "}
          har vi skickat en länk för att återställa lösenordet. Kolla även skräpposten.
        </p>
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">Tillbaka till inloggningen</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">E-postadress</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="namn@byran.se"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Skickar…" : "Skicka återställningslänk"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="underline-offset-4 hover:underline">
          Tillbaka till inloggningen
        </Link>
      </p>
    </form>
  );
}
