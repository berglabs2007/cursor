"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { History } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import type { GeneratedListingText, ListingVersion } from "@/lib/database.types";

interface VersionHistoryProps {
  listingId: string;
  versions: ListingVersion[];
}

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString("sv-SE", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function VersionHistory({ listingId, versions }: VersionHistoryProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  async function restore(version: ListingVersion) {
    setRestoringId(version.id);
    const supabase = createClient();
    const { error } = await supabase
      .from("listings")
      .update({ generated_text: version.content as GeneratedListingText })
      .eq("id", listingId);

    setRestoringId(null);

    if (error) {
      toast.error("Kunde inte återställa versionen. Försök igen.");
      return;
    }

    toast.success("Versionen har återställts.");
    setIsOpen(false);
    router.refresh();
  }

  if (versions.length === 0) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <History className="size-4" />
          Historik ({versions.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Versionshistorik</DialogTitle>
          <DialogDescription>
            Tidigare genererade texter. Att återställa en version sparar den nuvarande
            texten som en ny version – inget går förlorat.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {versions.map((version) => {
            const content = version.content;
            return (
              <Card key={version.id}>
                <CardContent className="space-y-2 py-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      {formatTimestamp(version.created_at)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => restore(version)}
                      disabled={restoringId !== null}
                    >
                      {restoringId === version.id ? "Återställer…" : "Återställ"}
                    </Button>
                  </div>
                  {content.headline ? (
                    <p className="text-sm font-medium">{content.headline}</p>
                  ) : null}
                  {content.body ? (
                    <p className="line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">
                      {content.body}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
