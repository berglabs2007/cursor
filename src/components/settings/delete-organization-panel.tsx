"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { callEdgeFunction, EdgeFunctionError } from "@/lib/edge-functions";
import { createClient } from "@/lib/supabase/client";
import { SITE } from "@/lib/site";

interface DeleteOrganizationPanelProps {
  organizationName: string;
}

export function DeleteOrganizationPanel({ organizationName }: DeleteOrganizationPanelProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const canConfirm = confirmation === organizationName;

  async function deleteOrganization() {
    if (!canConfirm) return;

    setIsLoading(true);
    try {
      await callEdgeFunction("delete-organization", { confirmation });
      const supabase = createClient();
      await supabase.auth.signOut();
      toast.success("Byråns data har raderats.");
      router.push("/");
      router.refresh();
    } catch (error) {
      const message =
        error instanceof EdgeFunctionError
          ? error.message
          : "Raderingen misslyckades. Försök igen eller kontakta support.";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-base text-destructive">Radera byrådata</CardTitle>
          <CardDescription>
            Permanent radering av er byrå, alla annonser, uppladdade bilder och användarkonton.
            Använd detta vid uppsägning av tjänsten. Åtgärden kan inte ångras.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Behöver ni hjälp? Kontakta{" "}
            <a href={`mailto:${SITE.privacyEmail}`} className="underline underline-offset-4">
              {SITE.privacyEmail}
            </a>{" "}
            innan ni raderar.
          </p>
          <Button variant="destructive" onClick={() => setOpen(true)}>
            Radera all byrådata
          </Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Radera {organizationName}?</DialogTitle>
            <DialogDescription>
              Alla annonser, bilder och medarbetarkonton tas bort permanent. Skriv byråns
              namn exakt för att bekräfta.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="delete-confirm">Byrånamn</Label>
            <Input
              id="delete-confirm"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder={organizationName}
              autoComplete="off"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Avbryt
            </Button>
            <Button
              variant="destructive"
              disabled={!canConfirm || isLoading}
              onClick={() => void deleteOrganization()}
            >
              {isLoading ? "Raderar…" : "Radera permanent"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
