"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { callEdgeFunction } from "@/lib/edge-functions";

interface RevokeInvitationButtonProps {
  invitationId: string;
  email: string;
}

export function RevokeInvitationButton({ invitationId, email }: RevokeInvitationButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function revoke() {
    setIsLoading(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("invitations")
      .update({ status: "revoked" })
      .eq("id", invitationId);

    setIsLoading(false);

    if (error) {
      toast.error("Kunde inte återkalla inbjudan. Försök igen.");
      return;
    }

    toast.success(`Inbjudan till ${email} har återkallats.`);
    await callEdgeFunction("sync-seats", {}).catch(() => undefined);
    router.refresh();
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={revoke}
      disabled={isLoading}
      aria-label={`Återkalla inbjudan till ${email}`}
    >
      <X className="size-4" />
      Återkalla
    </Button>
  );
}
