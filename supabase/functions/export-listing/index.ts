/**
 * export-listing
 *
 * Exports a listing as Word, Hemnet text, PDF, or social media captions.
 */
import { AuthError, requireAuth, requireListingInOrg } from "../_shared/auth.ts";
import { AnthropicError } from "../_shared/anthropic.ts";
import {
  buildExportFilename,
  buildListingDocx,
  type ListingExportData,
} from "../_shared/export-docx.ts";
import { buildHemnetFilename, buildHemnetText } from "../_shared/export-hemnet.ts";
import { buildListingPdf, buildPdfFilename } from "../_shared/export-pdf.ts";
import { generateSocialCaptions } from "../_shared/export-social.ts";
import { corsHeaders, errorResponse, handleOptions, jsonResponse } from "../_shared/http.ts";

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  villa: "Villa",
  apartment: "Lägenhet",
  townhouse: "Radhus",
  vacation_home: "Fritidshus",
};

type ExportFormat = "docx" | "hemnet" | "pdf" | "social";

interface ExportRequest {
  listing_id?: string;
  format?: ExportFormat;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions();
  if (req.method !== "POST") return errorResponse("Metoden stöds inte.", 405);

  try {
    const ctx = await requireAuth(req);

    let body: ExportRequest;
    try {
      body = (await req.json()) as ExportRequest;
    } catch {
      return errorResponse("Ogiltig förfrågan.", 400);
    }

    if (!body.listing_id) {
      return errorResponse("Annons-id saknas.", 400);
    }

    const format: ExportFormat = body.format ?? "docx";
    const listing = await requireListingInOrg(ctx, body.listing_id);

    const generatedText = listing.generated_text as {
      headline?: string;
      body?: string;
      facts?: string;
    } | null;

    if (
      !generatedText ||
      (!generatedText.headline?.trim() &&
        !generatedText.body?.trim() &&
        !generatedText.facts?.trim())
    ) {
      return errorResponse(
        "Annonsen saknar genererad text. Generera texten innan du exporterar.",
        400
      );
    }

    const { data: organization, error: orgError } = await ctx.admin
      .from("organizations")
      .select("name")
      .eq("id", ctx.organizationId)
      .maybeSingle();

    if (orgError || !organization) {
      console.error("export-listing: org lookup failed", orgError);
      return errorResponse("Kunde inte läsa byråns uppgifter. Försök igen.", 500);
    }

    const exportData: ListingExportData = {
      address: (listing.address as string) ?? "",
      organizationName: organization.name as string,
      propertyTypeLabel:
        PROPERTY_TYPE_LABELS[listing.property_type as string] ??
        (listing.property_type as string),
      rooms: listing.rooms as number | null,
      areaSqm: listing.area_sqm as number | null,
      supplementaryAreaSqm: listing.supplementary_area_sqm as number | null,
      plotAreaSqm: listing.plot_area_sqm as number | null,
      price: listing.price as number | null,
      monthlyFee: listing.monthly_fee as number | null,
      operatingCost: listing.operating_cost as number | null,
      buildYear: listing.build_year as number | null,
      generatedText,
    };

    const address = exportData.address || "export";

    if (format === "social") {
      const captions = await generateSocialCaptions(exportData);
      return jsonResponse(captions);
    }

    if (format === "hemnet") {
      const text = buildHemnetText(exportData);
      const filename = buildHemnetFilename(address);
      return new Response(text, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    if (format === "pdf") {
      const buffer = await buildListingPdf(exportData);
      const filename = buildPdfFilename(address);
      return new Response(buffer, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const buffer = await buildListingDocx(exportData);
    const filename = buildExportFilename(address);

    return new Response(Uint8Array.from(buffer), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error.message, error.status);
    }
    if (error instanceof AnthropicError) {
      return errorResponse(error.message, error.status);
    }
    console.error("export-listing: unexpected error", error);
    return errorResponse("Exporten misslyckades. Försök igen om en stund.", 500);
  }
});
