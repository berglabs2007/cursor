"use client";

import { useState } from "react";
import Image from "next/image";
import { AlertCircle, Check, Loader2, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { ImageAnalysisResult } from "@/lib/database.types";

export type ImageStatus = "uploading" | "pending" | "analyzing" | "done" | "error";

export interface ListingImageItem {
  id: string;
  storagePath: string;
  previewUrl: string | null;
  analysis: ImageAnalysisResult | null;
  status: ImageStatus;
  errorMessage?: string;
}

interface ImageCardProps {
  item: ListingImageItem;
  onRetry: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleConfirmed: (id: string, confirmed: boolean) => void;
  onSaveAnalysis: (id: string, analysis: ImageAnalysisResult) => Promise<boolean>;
}

const STATUS_LABEL: Record<ImageStatus, string> = {
  uploading: "Laddar upp…",
  pending: "Väntar på analys",
  analyzing: "Analyserar…",
  done: "Analyserad",
  error: "Fel",
};

export function ImageCard({
  item,
  onRetry,
  onDelete,
  onToggleConfirmed,
  onSaveAnalysis,
}: ImageCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editRoomType, setEditRoomType] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [editDetails, setEditDetails] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const analysis = item.analysis;
  const isExcluded = analysis?.confirmed === false;

  function openEditor() {
    if (!analysis) return;
    setEditRoomType(analysis.room_type);
    setEditSummary(analysis.summary);
    setEditDetails(analysis.notable_details.join(", "));
    setIsEditing(true);
  }

  async function saveEdits() {
    if (!analysis) return;
    setIsSaving(true);
    const saved = await onSaveAnalysis(item.id, {
      ...analysis,
      room_type: editRoomType.trim() || "okänd",
      summary: editSummary.trim(),
      notable_details: editDetails
        .split(",")
        .map((detail) => detail.trim())
        .filter(Boolean),
    });
    setIsSaving(false);
    if (saved) setIsEditing(false);
  }

  return (
    <Card className={isExcluded ? "opacity-60" : undefined}>
      <CardContent className="space-y-3 p-3">
        <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-muted">
          {item.previewUrl ? (
            <Image
              src={item.previewUrl}
              alt={analysis?.room_type ?? "Objektbild"}
              fill
              unoptimized
              className="object-cover"
              sizes="(max-width: 640px) 100vw, 33vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}
          <div className="absolute left-2 top-2">
            {item.status === "done" && analysis ? (
              <Badge variant={isExcluded ? "secondary" : "default"}>
                {isExcluded ? "Används inte" : analysis.room_type}
              </Badge>
            ) : (
              <Badge variant="secondary">
                {item.status === "error" ? (
                  <AlertCircle className="size-3" />
                ) : (
                  <Loader2 className="size-3 animate-spin" />
                )}
                {STATUS_LABEL[item.status]}
              </Badge>
            )}
          </div>
        </div>

        {item.status === "error" ? (
          <div className="space-y-2">
            <p className="text-xs text-destructive">
              {item.errorMessage ?? "Analysen misslyckades."}
            </p>
            <Button variant="outline" size="sm" className="w-full" onClick={() => onRetry(item.id)}>
              <RefreshCw className="size-3.5" />
              Analysera igen
            </Button>
          </div>
        ) : item.status === "pending" ? (
          <Button variant="outline" size="sm" className="w-full" onClick={() => onRetry(item.id)}>
            <RefreshCw className="size-3.5" />
            Analysera
          </Button>
        ) : null}

        {analysis && item.status === "done" ? (
          <div className="space-y-2">
            <p className="line-clamp-3 text-xs text-muted-foreground">{analysis.summary}</p>
            {analysis.notable_details.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {analysis.notable_details.slice(0, 3).map((detail) => (
                  <Badge key={detail} variant="outline" className="text-[10px]">
                    {detail}
                  </Badge>
                ))}
                {analysis.notable_details.length > 3 ? (
                  <Badge variant="outline" className="text-[10px]">
                    +{analysis.notable_details.length - 3}
                  </Badge>
                ) : null}
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-2 pt-1">
              <label className="flex cursor-pointer items-center gap-2 text-xs">
                <Switch
                  checked={!isExcluded}
                  onCheckedChange={(checked) => onToggleConfirmed(item.id, checked)}
                  aria-label="Använd bildens analys i annonstexten"
                />
                Använd
              </label>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={openEditor}
                  aria-label="Redigera analysen"
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-destructive hover:text-destructive"
                  onClick={() => onDelete(item.id)}
                  aria-label="Ta bort bilden"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          </div>
        ) : item.status !== "error" ? null : (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-destructive hover:text-destructive"
              onClick={() => onDelete(item.id)}
              aria-label="Ta bort bilden"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        )}
      </CardContent>

      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Redigera bildanalys</DialogTitle>
            <DialogDescription>
              Justera vad AI:n uppfattade – det redigerade underlaget används när
              annonstexten genereras.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`roomType-${item.id}`}>Rumstyp</Label>
              <Input
                id={`roomType-${item.id}`}
                value={editRoomType}
                onChange={(e) => setEditRoomType(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`summary-${item.id}`}>Sammanfattning</Label>
              <Textarea
                id={`summary-${item.id}`}
                rows={3}
                value={editSummary}
                onChange={(e) => setEditSummary(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`details-${item.id}`}>Notabla detaljer (kommaseparerade)</Label>
              <Input
                id={`details-${item.id}`}
                placeholder="öppen spis, havsutsikt"
                value={editDetails}
                onChange={(e) => setEditDetails(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={saveEdits} disabled={isSaving}>
              {isSaving ? (
                "Sparar…"
              ) : (
                <>
                  <Check className="size-4" />
                  Spara
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
