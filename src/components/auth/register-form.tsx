"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { GoogleButton } from "@/components/auth/google-button";
import { createClient } from "@/lib/supabase/client";

const ORG_NUMBER_PATTERN = /^\d{6}-?\d{4}$/;

export function RegisterForm() {
  const router = useRouter();
  const [organizationName, setOrganizationName] = useState("");
  const [orgNumber, setOrgNumber] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (orgNumber && !ORG_NUMBER_PATTERN.test(orgNumber)) {
      toast.error("Organisationsnumret ska ha formatet 556677-8899.");
      return;
    }
    if (password.length < 8) {
      toast.error("Lösenordet måste vara minst 8 tecken.");
      return;
    }

    setIsLoading(true);
    const supabase = createClient();

    // The database trigger handle_new_user() reads this metadata and
    // creates the organization + owner profile atomically.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
        data: {
          organization_name: organizationName.trim(),
          org_number: orgNumber.trim(),
          full_name: fullName.trim(),
        },
      },
    });

    if (error) {
      setIsLoading(false);
      if (error.code === "user_already_exists") {
        toast.error("Det finns redan ett konto med den e-postadressen. Logga in i stället.");
      } else if (error.code === "weak_password") {
        toast.error("Lösenordet är för svagt. Välj ett längre eller mer varierat lösenord.");
      } else {
        toast.error("Registreringen misslyckades. Försök igen om en stund.");
      }
      return;
    }

    // With email confirmation enabled there is no session yet.
    if (!data.session) {
      toast.success("Konto skapat! Bekräfta din e-postadress via länken vi skickat.");
      router.push("/login");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <GoogleButton label="Registrera med Google" />

      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">eller med e-post</span>
        <Separator className="flex-1" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="organizationName">Byråns namn</Label>
          <Input
            id="organizationName"
            placeholder="Mäklarbyrån AB"
            value={organizationName}
            onChange={(e) => setOrganizationName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="orgNumber">
            Organisationsnummer <span className="text-muted-foreground">(valfritt)</span>
          </Label>
          <Input
            id="orgNumber"
            placeholder="556677-8899"
            inputMode="numeric"
            value={orgNumber}
            onChange={(e) => setOrgNumber(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fullName">Ditt namn</Label>
          <Input
            id="fullName"
            autoComplete="name"
            placeholder="Anna Andersson"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </div>
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
          <Label htmlFor="password">Lösenord</Label>
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
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Skapar konto…" : "Skapa konto"}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Genom att registrera godkänner du våra{" "}
          <Link href="/villkor" className="underline underline-offset-4 hover:text-foreground">
            villkor
          </Link>{" "}
          och{" "}
          <Link
            href="/integritetspolicy"
            className="underline underline-offset-4 hover:text-foreground"
          >
            integritetspolicy
          </Link>
          .
        </p>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Har ni redan ett konto?{" "}
        <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          Logga in
        </Link>
      </p>
    </div>
  );
}
