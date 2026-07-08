"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { downloadEdgeFunction, EdgeFunctionError } from "@/lib/edge-functions";

interface ExportListingButtonProps {
  listingId: string;
  address: string;
  disabled?: boolean;
}

function exportFilename(address: string): string {
  const slug = address
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

  return `annons-${slug || "export"}.docx`;
}

export function ExportListingButton({
  listingId,
  address,
  disabled,
}: ExportListingButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  async function handleExport() {
    setIsExporting(true);
    try {
      await downloadEdgeFunction(
        "export-listing",
        { listing_id: listingId },
        exportFilename(address)
      );
      toast.success("Word-dokumentet har laddats ner.");
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

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={disabled || isExporting}>
      <Download className="size-4" />
      {isExporting ? "Exporterar…" : "Exportera Word"}
    </Button>
  );
}
