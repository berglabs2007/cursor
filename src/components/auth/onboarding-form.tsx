"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

const ORG_NUMBER_PATTERN = /^\d{6}-?\d{4}$/;

/**
 * Completes onboarding for users who signed in via Google and therefore
 * have no organization yet. Calls the create_organization() database
 * function which creates the org and an owner profile.
 */
export function OnboardingForm() {
  const router = useRouter();
  const [organizationName, setOrganizationName] = useState("");
  const [orgNumber, setOrgNumber] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (orgNumber && !ORG_NUMBER_PATTERN.test(orgNumber)) {
      toast.error("Organisationsnumret ska ha formatet 556677-8899.");
      return;
    }

    setIsLoading(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("create_organization", {
      org_name: organizationName.trim(),
      org_number_input: orgNumber.trim() || null,
    });

    if (error) {
      setIsLoading(false);
      if (error.message.includes("already belongs")) {
        router.push("/dashboard");
        return;
      }
      toast.error("Det gick inte att skapa byrån. Försök igen.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
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
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Skapar byrå…" : "Skapa byrå och fortsätt"}
      </Button>
    </form>
  );
}
