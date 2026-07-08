"use client";

import { useEffect, useRef, useState } from "react";
import { ImageUp } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { ImageCard, type ListingImageItem } from "@/components/listings/image-card";
import { createClient } from "@/lib/supabase/client";
import { callEdgeFunction, EdgeFunctionError } from "@/lib/edge-functions";
import {
  ACCEPTED_IMAGE_TYPES,
  compressImage,
} from "@/lib/image-utils";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import type { ImageAnalysisResult, ListingImage } from "@/lib/database.types";

const ANALYSIS_CONCURRENCY = 2;
const SIGNED_URL_TTL_SECONDS = 3600;

interface ImageSectionProps {
  listingId: string;
  organizationId: string;
  initialImages: ListingImage[];
}

interface AnalyzeResponse {
  image_id: string;
  analysis: ImageAnalysisResult;
}

export function ImageSection({ listingId, organizationId, initialImages }: ImageSectionProps) {
  const [items, setItems] = useState<ListingImageItem[]>(() =>
    initialImages.map((image) => ({
      id: image.id,
      storagePath: image.storage_path,
      previewUrl: null,
      analysis: image.ai_analysis_result,
      status: image.ai_analysis_result ? "done" : "pending",
    }))
  );
  const [isDragging, setIsDragging] = useState(false);
  const [autoAnalyze, setAutoAnalyze] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeAnalysesRef = useRef(0);
  const queueRef = useRef<string[]>([]);
  const initialAnalysisTriggeredRef = useRef(false);

  function updateItem(id: string, patch: Partial<ListingImageItem>) {
    setItems((previous) =>
      previous.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  }

  function processQueue() {
    while (
      activeAnalysesRef.current < ANALYSIS_CONCURRENCY &&
      queueRef.current.length > 0
    ) {
      const imageId = queueRef.current.shift();
      if (!imageId) break;
      activeAnalysesRef.current += 1;

      void (async () => {
        try {
          const response = await callEdgeFunction<AnalyzeResponse>("analyze-images", {
            image_id: imageId,
          });
          updateItem(imageId, { status: "done", analysis: response.analysis });
        } catch (error) {
          updateItem(imageId, {
            status: "error",
            errorMessage:
              error instanceof EdgeFunctionError
                ? error.message
                : "Analysen misslyckades. Försök igen.",
          });
        } finally {
          activeAnalysesRef.current -= 1;
          processQueue();
        }
      })();
    }
  }

  function enqueueAnalysis(imageId: string) {
    updateItem(imageId, { status: "analyzing", errorMessage: undefined });
    queueRef.current.push(imageId);
    processQueue();
  }

  // Signed preview URLs for images loaded from the database.
  useEffect(() => {
    const paths = initialImages.map((image) => image.storage_path);
    if (paths.length === 0) return;

    const supabase = createClient();
    void supabase.storage
      .from("listing-images")
      .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS)
      .then(({ data }) => {
        if (!data) return;
        setItems((previous) =>
          previous.map((item) => {
            const match = data.find((entry) => entry.path === item.storagePath);
            return match?.signedUrl && !item.previewUrl
              ? { ...item, previewUrl: match.signedUrl }
              : item;
          })
        );
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-analyze pending images on load when auto mode is enabled.
  useEffect(() => {
    if (initialAnalysisTriggeredRef.current) return;
    initialAnalysisTriggeredRef.current = true;

    const pendingIds = initialImages
      .filter((image) => !image.ai_analysis_result)
      .map((image) => image.id);
    if (pendingIds.length === 0 || !autoAnalyze) return;

    const timer = setTimeout(() => {
      for (const id of pendingIds) enqueueAnalysis(id);
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList).filter((file) =>
      ACCEPTED_IMAGE_TYPES.includes(file.type)
    );

    if (files.length === 0) {
      toast.error("Endast JPEG-, PNG- och WebP-bilder stöds.");
      return;
    }

    const supabase = createClient();

    for (const file of files) {
      const localPreview = URL.createObjectURL(file);
      const temporaryId = `upload-${crypto.randomUUID()}`;

      setItems((previous) => [
        ...previous,
        {
          id: temporaryId,
          storagePath: "",
          previewUrl: localPreview,
          analysis: null,
          status: "uploading",
        },
      ]);

      try {
        const compressed = await compressImage(file);
        const storagePath = `${organizationId}/${listingId}/${crypto.randomUUID()}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from("listing-images")
          .upload(storagePath, compressed, { contentType: "image/jpeg" });

        if (uploadError) throw uploadError;

        const { data: row, error: insertError } = await supabase
          .from("listing_images")
          .insert({
            listing_id: listingId,
            organization_id: organizationId,
            storage_path: storagePath,
            sort_order: items.length,
          })
          .select("id")
          .single();

        if (insertError || !row) throw insertError ?? new Error("insert failed");

        setItems((previous) =>
          previous.map((item) =>
            item.id === temporaryId
              ? {
                  ...item,
                  id: row.id,
                  storagePath,
                  status: autoAnalyze ? "analyzing" : "pending",
                }
              : item
          )
        );
        if (autoAnalyze) {
          enqueueAnalysis(row.id);
        }
      } catch (error) {
        console.error("image upload failed", error);
        setItems((previous) => previous.filter((item) => item.id !== temporaryId));
        URL.revokeObjectURL(localPreview);
        toast.error(`Kunde inte ladda upp ${file.name}. Försök igen.`);
      }
    }
  }

  async function deleteImage(id: string) {
    const item = items.find((entry) => entry.id === id);
    if (!item) return;

    const supabase = createClient();
    const { error } = await supabase.from("listing_images").delete().eq("id", id);

    if (error) {
      toast.error("Kunde inte ta bort bilden. Försök igen.");
      return;
    }

    if (item.storagePath) {
      await supabase.storage.from("listing-images").remove([item.storagePath]);
    }

    setItems((previous) => previous.filter((entry) => entry.id !== id));
  }

  async function persistAnalysis(
    id: string,
    analysis: ImageAnalysisResult
  ): Promise<boolean> {
    const supabase = createClient();
    const { error } = await supabase
      .from("listing_images")
      .update({ ai_analysis_result: analysis })
      .eq("id", id);

    if (error) {
      toast.error("Kunde inte spara ändringen. Försök igen.");
      return false;
    }

    updateItem(id, { analysis });
    return true;
  }

  async function toggleConfirmed(id: string, confirmed: boolean) {
    const item = items.find((entry) => entry.id === id);
    if (!item?.analysis) return;
    await persistAnalysis(id, { ...item.analysis, confirmed });
  }

  const doneCount = items.filter(
    (item) => item.status === "done" && item.analysis?.confirmed !== false
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Bilder</h2>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Switch
              checked={autoAnalyze}
              onCheckedChange={setAutoAnalyze}
              aria-label="Analysera bilder automatiskt vid uppladdning"
            />
            Auto-analys
          </label>
          {items.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              {doneCount} av {items.length} bilder används som underlag
            </p>
          ) : null}
        </div>
      </div>

      <Card
        className={cn(
          "border-dashed transition-colors",
          isDragging && "border-primary bg-secondary/50"
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          void handleFiles(e.dataTransfer.files);
        }}
      >
        <CardContent
          className="flex cursor-pointer flex-col items-center justify-center gap-2 py-8 text-center"
          onClick={() => fileInputRef.current?.click()}
          role="button"
          aria-label="Ladda upp bilder"
        >
          <ImageUp className="size-6 text-muted-foreground" />
          <p className="text-sm font-medium">
            Dra och släpp bilder här, eller klicka för att välja
          </p>
          <p className="text-xs text-muted-foreground">
            5–20 bilder rekommenderas · JPEG, PNG eller WebP · Auto-analys kan stängas av
            för manuell analys per bild
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_IMAGE_TYPES.join(",")}
            className="hidden"
            onChange={(e) => {
              if (e.target.files) void handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </CardContent>
      </Card>

      {items.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <ImageCard
              key={item.id}
              item={item}
              onRetry={enqueueAnalysis}
              onDelete={(id) => void deleteImage(id)}
              onToggleConfirmed={(id, confirmed) => void toggleConfirmed(id, confirmed)}
              onSaveAnalysis={persistAnalysis}
            />
          ))}
        </div>
      ) : null}

      {doneCount > 0 ? (
        <p className="text-xs text-muted-foreground">
          Bildernas säljpunkter vävs in nästa gång du genererar annonstexten.
        </p>
      ) : null}
    </div>
  );
}
