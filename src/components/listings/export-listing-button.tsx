"use client";

import { useState } from "react";
import { Check, Copy, Download, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { callEdgeFunction, downloadEdgeFunction, EdgeFunctionError } from "@/lib/edge-functions";

interface ExportListingButtonProps {
  listingId: string;
  address: string;
  disabled?: boolean;
}

type ExportFormat = "docx" | "hemnet" | "pdf" | "social";

interface SocialCaptionVariant {
  label: string;
  caption: string;
}

interface SocialCaptionsResult {
  instagram: SocialCaptionVariant[];
  facebook: SocialCaptionVariant[];
}

function exportSlug(address: string): string {
  return address
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function filenameFor(format: Exclude<ExportFormat, "social">, address: string): string {
  const slug = exportSlug(address) || "export";
  switch (format) {
    case "hemnet":
      return `hemnet-${slug}.txt`;
    case "pdf":
      return `annons-${slug}.pdf`;
    default:
      return `annons-${slug}.docx`;
  }
}

function CaptionBlock({ variant }: { variant: SocialCaptionVariant }) {
  const [copied, setCopied] = useState(false);

  async function copyCaption() {
    await navigator.clipboard.writeText(variant.caption);
    setCopied(true);
    toast.success("Kopierat till urklipp.");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{variant.label}</p>
        <Button variant="ghost" size="sm" onClick={copyCaption}>
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          Kopiera
        </Button>
      </div>
      <p className="whitespace-pre-wrap text-sm text-muted-foreground">{variant.caption}</p>
    </div>
  );
}

export function ExportListingButton({
  listingId,
  address,
  disabled,
}: ExportListingButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [socialOpen, setSocialOpen] = useState(false);
  const [socialCaptions, setSocialCaptions] = useState<SocialCaptionsResult | null>(null);

  async function handleDownload(format: Exclude<ExportFormat, "social">) {
    setIsExporting(true);
    try {
      await downloadEdgeFunction(
        "export-listing",
        { listing_id: listingId, format },
        filenameFor(format, address)
      );
      toast.success("Exporten har laddats ner.");
    } catch (error) {
      toast.error(
        error instanceof EdgeFunctionError
          ? error.message
          : "Exporten misslyckades. Försök igen."
      );
    } finally {
      setIsExporting(false);
    }
  }

  async function handleSocialExport() {
    setIsExporting(true);
    try {
      const captions = await callEdgeFunction<SocialCaptionsResult>("export-listing", {
        listing_id: listingId,
        format: "social",
      });
      setSocialCaptions(captions);
      setSocialOpen(true);
    } catch (error) {
      toast.error(
        error instanceof EdgeFunctionError
          ? error.message
          : "Kunde inte generera captions. Försök igen."
      );
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={disabled || isExporting}>
            {isExporting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            {isExporting ? "Exporterar…" : "Exportera"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => void handleDownload("docx")}>
            Word-dokument (.docx)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void handleDownload("hemnet")}>
            Hemnet-text (.txt)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void handleDownload("pdf")}>
            PDF
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void handleSocialExport()}>
            <Share2 className="size-4" />
            Sociala medier-captions
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={socialOpen} onOpenChange={setSocialOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Sociala medier-captions</DialogTitle>
            <DialogDescription>
              Färdiga texter för Instagram och Facebook. Kopiera den variant du vill använda.
            </DialogDescription>
          </DialogHeader>
          {socialCaptions ? (
            <Tabs defaultValue="instagram">
              <TabsList className="w-full">
                <TabsTrigger value="instagram" className="flex-1">
                  Instagram
                </TabsTrigger>
                <TabsTrigger value="facebook" className="flex-1">
                  Facebook
                </TabsTrigger>
              </TabsList>
              <TabsContent value="instagram" className="space-y-3 pt-2">
                {socialCaptions.instagram.map((variant) => (
                  <CaptionBlock key={variant.label} variant={variant} />
                ))}
              </TabsContent>
              <TabsContent value="facebook" className="space-y-3 pt-2">
                {socialCaptions.facebook.map((variant) => (
                  <CaptionBlock key={variant.label} variant={variant} />
                ))}
              </TabsContent>
            </Tabs>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
