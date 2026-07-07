"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { callEdgeFunction, EdgeFunctionError } from "@/lib/edge-functions";

export function InviteMemberDialog() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"agent" | "admin">("agent");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);

    try {
      await callEdgeFunction<{ success: boolean }>("invite-user", {
        email,
        role,
        full_name: fullName,
      });
      toast.success(`Inbjudan skickad till ${email}.`);
      setIsOpen(false);
      setEmail("");
      setFullName("");
      setRole("agent");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof EdgeFunctionError
          ? error.message
          : "Kunde inte skicka inbjudan. Försök igen."
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="size-4" />
          Bjud in mäklare
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Bjud in en mäklare</DialogTitle>
          <DialogDescription>
            Personen får ett e-postmeddelande med en länk för att skapa sitt konto i er byrå.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="inviteEmail">E-postadress</Label>
            <Input
              id="inviteEmail"
              type="email"
              placeholder="namn@byran.se"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inviteName">
              Namn <span className="text-muted-foreground">(valfritt)</span>
            </Label>
            <Input
              id="inviteName"
              placeholder="Anna Andersson"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inviteRole">Roll</Label>
            <Select value={role} onValueChange={(value) => setRole(value as "agent" | "admin")}>
              <SelectTrigger id="inviteRole" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="agent">Mäklare</SelectItem>
                <SelectItem value="admin">Administratör</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" className="w-full sm:w-auto" disabled={isLoading}>
              {isLoading ? "Skickar…" : "Skicka inbjudan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
