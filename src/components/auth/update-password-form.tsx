"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

/**
 * Sets a new password. Used both after password reset and when an
 * invited user follows their invite link for the first time.
 */
export function UpdatePasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isWelcome = searchParams.get("valkommen") === "1";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password.length < 8) {
      toast.error("Lösenordet måste vara minst 8 tecken.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Lösenorden matchar inte.");
      return;
    }

    setIsLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setIsLoading(false);
      if (error.code === "same_password") {
        toast.error("Det nya lösenordet får inte vara samma som det gamla.");
      } else {
        toast.error("Det gick inte att uppdatera lösenordet. Försök igen.");
      }
      return;
    }

    toast.success(isWelcome ? "Välkommen! Ditt lösenord är satt." : "Lösenordet är uppdaterat.");
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">Nytt lösenord</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <p className="text-xs text-muted-foreground">Minst 8 tecken.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Upprepa lösenordet</Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Sparar…" : "Spara lösenord"}
      </Button>
    </form>
  );
}
