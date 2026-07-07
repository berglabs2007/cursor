"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";

interface MemberActionsProps {
  memberId: string;
  memberName: string;
}

export function MemberActions({ memberId, memberName }: MemberActionsProps) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function removeMember() {
    setIsLoading(true);
    const supabase = createClient();
    const { error } = await supabase.from("profiles").delete().eq("id", memberId);

    setIsLoading(false);

    if (error) {
      toast.error("Kunde inte ta bort medarbetaren. Försök igen.");
      return;
    }

    toast.success(`${memberName} har tagits bort från byrån.`);
    setShowConfirm(false);
    router.refresh();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Åtgärder för ${memberName}`}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem variant="destructive" onSelect={() => setShowConfirm(true)}>
            <Trash2 className="size-4" />
            Ta bort från byrån
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ta bort {memberName}?</DialogTitle>
            <DialogDescription>
              Personen förlorar åtkomst till byråns annonser. Annonser som personen skapat
              finns kvar hos byrån.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowConfirm(false)}>
              Avbryt
            </Button>
            <Button variant="destructive" onClick={removeMember} disabled={isLoading}>
              {isLoading ? "Tar bort…" : "Ta bort"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
