"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GenerationPanel } from "@/components/listings/generation-panel";
import { ExportListingButton } from "@/components/listings/export-listing-button";
import { ImageSection } from "@/components/listings/image-section";
import { ListingForm } from "@/components/listings/listing-form";
import { VersionHistory } from "@/components/listings/version-history";
import { createClient } from "@/lib/supabase/client";
import { PROPERTY_TYPE_LABELS, STATUS_LABELS } from "@/lib/listing-constants";
import type { Listing, ListingImage, ListingVersion } from "@/lib/database.types";

interface ListingEditorProps {
  listing: Listing;
  images: ListingImage[];
  versions: ListingVersion[];
  autoStart: boolean;
}

export function ListingEditor({ listing, images, versions, autoStart }: ListingEditorProps) {
  const router = useRouter();
  const [showDetails, setShowDetails] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  async function toggleStatus() {
    setIsTogglingStatus(true);
    const nextStatus = listing.status === "draft" ? "final" : "draft";
    const supabase = createClient();
    const { error } = await supabase
      .from("listings")
      .update({ status: nextStatus })
      .eq("id", listing.id);

    setIsTogglingStatus(false);

    if (error) {
      toast.error("Kunde inte ändra status. Försök igen.");
      return;
    }

    toast.success(
      nextStatus === "final" ? "Annonsen är markerad som klar." : "Annonsen är åter ett utkast."
    );
    router.refresh();
  }

  const facts = [
    listing.rooms !== null ? `${listing.rooms} rum` : null,
    listing.area_sqm !== null ? `${listing.area_sqm} m²` : null,
    listing.price !== null
      ? `${new Intl.NumberFormat("sv-SE").format(listing.price)} kr`
      : null,
  ].filter(Boolean);

  const hasGeneratedText = Boolean(
    listing.generated_text?.headline?.trim() ||
      listing.generated_text?.body?.trim() ||
      listing.generated_text?.facts?.trim()
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {listing.address || "Annons utan adress"}
            </h1>
            <Badge variant={listing.status === "final" ? "default" : "secondary"}>
              {STATUS_LABELS[listing.status]}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {[PROPERTY_TYPE_LABELS[listing.property_type], ...facts].join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportListingButton
            listingId={listing.id}
            address={listing.address}
            disabled={!hasGeneratedText}
          />
          <VersionHistory listingId={listing.id} versions={versions} />
          <Button
            variant="outline"
            size="sm"
            onClick={toggleStatus}
            disabled={isTogglingStatus}
          >
            {isTogglingStatus
              ? "Sparar…"
              : listing.status === "draft"
                ? "Markera som klar"
                : "Markera som utkast"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader
          className="cursor-pointer select-none flex-row items-center justify-between space-y-0"
          onClick={() => setShowDetails((previous) => !previous)}
        >
          <CardTitle className="text-sm font-medium">Objektsuppgifter</CardTitle>
          <Button variant="ghost" size="sm" aria-label="Visa eller dölj objektsuppgifter">
            {showDetails ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </Button>
        </CardHeader>
        {showDetails ? (
          <CardContent>
            <ListingForm
              listing={listing}
              submitLabel="Spara uppgifter"
              onSaved={() => {
                toast.success(
                  "Uppgifterna är sparade. Generera om texten för att uppdatera annonsen."
                );
                setShowDetails(false);
                router.refresh();
              }}
            />
          </CardContent>
        ) : null}
      </Card>

      <ImageSection
        listingId={listing.id}
        organizationId={listing.organization_id}
        initialImages={images}
      />

      <GenerationPanel
        listingId={listing.id}
        initialText={listing.generated_text}
        autoStart={autoStart}
      />
    </div>
  );
}
