"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Copy, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import {
  streamListingGeneration,
  type GenerationPart,
} from "@/lib/listing-generation";
import type { GeneratedListingText } from "@/lib/database.types";

const PART_TITLES: Record<GenerationPart, string> = {
  headline: "Rubrik (Hemnet)",
  body: "Säljande löptext",
  facts: "Objektsfakta",
};

const PART_ORDER: GenerationPart[] = ["headline", "body", "facts"];

const PART_ROWS: Record<GenerationPart, number> = {
  headline: 2,
  body: 12,
  facts: 7,
};

type PartTexts = Record<GenerationPart, string>;

interface GenerationPanelProps {
  listingId: string;
  initialText: GeneratedListingText | null;
  /** Generate everything immediately (used right after listing creation). */
  autoStart?: boolean;
}

function toPartTexts(text: GeneratedListingText | null): PartTexts {
  return {
    headline: text?.headline ?? "",
    body: text?.body ?? "",
    facts: text?.facts ?? "",
  };
}

export function GenerationPanel({ listingId, initialText, autoStart }: GenerationPanelProps) {
  const router = useRouter();
  const [texts, setTexts] = useState<PartTexts>(() => toPartTexts(initialText));
  const [savedTexts, setSavedTexts] = useState<PartTexts>(() => toPartTexts(initialText));
  const [streamingPart, setStreamingPart] = useState<GenerationPart | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<{ message: string; scope: GenerationPart | "all" } | null>(
    null
  );
  const [copiedPart, setCopiedPart] = useState<GenerationPart | "all" | null>(null);
  const [isSavingEdits, setIsSavingEdits] = useState(false);
  const autoStartedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const hasAnyText = PART_ORDER.some((part) => texts[part].trim().length > 0);
  const isDirty = PART_ORDER.some((part) => texts[part] !== savedTexts[part]);

  const runGeneration = useCallback(
    async (scope: GenerationPart | "all") => {
      setError(null);
      setIsGenerating(true);

      const controller = new AbortController();
      abortRef.current = controller;

      // Clear the parts that will be regenerated so streaming starts clean.
      const targetParts = scope === "all" ? PART_ORDER : [scope];
      setTexts((previous) => {
        const next = { ...previous };
        for (const part of targetParts) next[part] = "";
        return next;
      });

      try {
        for await (const event of streamListingGeneration(listingId, scope, controller.signal)) {
          switch (event.type) {
            case "part_start":
              setStreamingPart(event.part);
              setTexts((previous) => ({ ...previous, [event.part]: "" }));
              break;
            case "delta":
              setTexts((previous) => ({
                ...previous,
                [event.part]: previous[event.part] + event.text,
              }));
              break;
            case "part_done":
              setTexts((previous) => ({ ...previous, [event.part]: event.text }));
              break;
            case "done": {
              const finalTexts = toPartTexts(event.generated_text);
              setTexts(finalTexts);
              setSavedTexts(finalTexts);
              router.refresh();
              break;
            }
            case "error":
              setError({ message: event.message, scope });
              break;
          }
        }
      } finally {
        setStreamingPart(null);
        setIsGenerating(false);
        abortRef.current = null;
      }
    },
    [listingId, router]
  );

  useEffect(() => {
    if (autoStart && !autoStartedRef.current && !hasAnyText) {
      autoStartedRef.current = true;
      void runGeneration("all");
    }
  }, [autoStart, hasAnyText, runGeneration]);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function copyText(scope: GenerationPart | "all") {
    const value =
      scope === "all"
        ? PART_ORDER.map((part) => texts[part].trim())
            .filter(Boolean)
            .join("\n\n")
        : texts[scope];

    if (!value.trim()) return;

    try {
      await navigator.clipboard.writeText(value);
      setCopiedPart(scope);
      setTimeout(() => setCopiedPart(null), 2000);
    } catch {
      toast.error("Kunde inte kopiera till urklipp.");
    }
  }

  async function saveEdits() {
    setIsSavingEdits(true);
    const supabase = createClient();
    const { error: saveError } = await supabase
      .from("listings")
      .update({
        generated_text: {
          headline: texts.headline,
          body: texts.body,
          facts: texts.facts,
        },
      })
      .eq("id", listingId);

    setIsSavingEdits(false);

    if (saveError) {
      toast.error("Kunde inte spara texten. Försök igen – dina ändringar finns kvar.");
      return;
    }

    setSavedTexts({ ...texts });
    toast.success("Texten är sparad.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Annonstext</h2>
        <div className="flex flex-wrap gap-2">
          {hasAnyText ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyText("all")}
              disabled={isGenerating}
            >
              {copiedPart === "all" ? <Check className="size-4" /> : <Copy className="size-4" />}
              Kopiera allt
            </Button>
          ) : null}
          <Button size="sm" onClick={() => runGeneration("all")} disabled={isGenerating}>
            <Sparkles className="size-4" />
            {isGenerating
              ? "Genererar…"
              : hasAnyText
                ? "Generera om allt"
                : "Generera annonstext"}
          </Button>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Genereringen misslyckades</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <span>{error.message} Dina inmatade uppgifter är sparade.</span>
            <Button
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() => runGeneration(error.scope)}
            >
              <RefreshCw className="size-4" />
              Försök igen
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {PART_ORDER.map((part) => {
        const isStreamingThis = streamingPart === part;
        const isPendingThis =
          isGenerating && !isStreamingThis && texts[part] === "" && streamingPart !== null
            ? PART_ORDER.indexOf(part) > PART_ORDER.indexOf(streamingPart)
            : false;

        return (
          <Card key={part}>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">
                {PART_TITLES[part]}
                {isStreamingThis ? (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    skriver…
                  </span>
                ) : null}
              </CardTitle>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyText(part)}
                  disabled={!texts[part].trim() || isGenerating}
                  aria-label={`Kopiera ${PART_TITLES[part]}`}
                >
                  {copiedPart === part ? <Check className="size-4" /> : <Copy className="size-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => runGeneration(part)}
                  disabled={isGenerating}
                  aria-label={`Generera om ${PART_TITLES[part]}`}
                >
                  <RefreshCw className="size-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isStreamingThis || (isGenerating && texts[part]) ? (
                <p className="min-h-10 whitespace-pre-wrap text-sm leading-relaxed">
                  {texts[part]}
                  <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-foreground align-middle" />
                </p>
              ) : isPendingThis ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ) : (
                <Textarea
                  value={texts[part]}
                  onChange={(e) =>
                    setTexts((previous) => ({ ...previous, [part]: e.target.value }))
                  }
                  rows={PART_ROWS[part]}
                  disabled={isGenerating}
                  placeholder="Ingen text ännu – klicka på Generera annonstext."
                  className="resize-y text-sm leading-relaxed"
                />
              )}
            </CardContent>
          </Card>
        );
      })}

      {isDirty && !isGenerating ? (
        <div className="flex justify-end">
          <Button onClick={saveEdits} disabled={isSavingEdits}>
            {isSavingEdits ? "Sparar…" : "Spara redigerad text"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
