"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { GoogleButton } from "@/components/auth/google-button";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const error = searchParams.get("error");
    if (error) {
      toast.error(error);
    }
  }, [searchParams]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setIsLoading(false);
      if (error.code === "invalid_credentials") {
        toast.error("Fel e-postadress eller lösenord.");
      } else if (error.code === "email_not_confirmed") {
        toast.error("Bekräfta din e-postadress via länken vi skickat innan du loggar in.");
      } else {
        toast.error("Inloggningen misslyckades. Försök igen om en stund.");
      }
      return;
    }

    const next = searchParams.get("next");
    const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
    router.push(safeNext);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <GoogleButton label="Logga in med Google" />

      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">eller</span>
        <Separator className="flex-1" />
      </div>

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
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Lösenord</Label>
            <Link
              href="/aterstall-losenord"
              className="text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              Glömt lösenordet?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Loggar in…" : "Logga in"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Har din byrå inget konto?{" "}
        <Link href="/registrera" className="font-medium text-foreground underline-offset-4 hover:underline">
          Registrera er här
        </Link>
      </p>
    </div>
  );
}
