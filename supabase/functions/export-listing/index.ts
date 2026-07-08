/**
 * export-listing
 *
 * Exports a listing as a formatted Word document (.docx) ready to paste
 * into Hemnet, Vitec or other broker systems.
 */
import { AuthError, requireAuth, requireListingInOrg } from "../_shared/auth.ts";
import { buildExportFilename, buildListingDocx } from "../_shared/export-docx.ts";
import { corsHeaders, errorResponse, handleOptions } from "../_shared/http.ts";
import { requireActiveSubscription, SubscriptionError } from "../_shared/subscription-guard.ts";

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  villa: "Villa",
  apartment: "Lägenhet",
  townhouse: "Radhus",
  vacation_home: "Fritidshus",
};

interface ExportRequest {
  listing_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions();
  if (req.method !== "POST") return errorResponse("Metoden stöds inte.", 405);

  try {
    const ctx = await requireAuth(req);
    await requireActiveSubscription(ctx);

    let body: ExportRequest;
    try {
      body = (await req.json()) as ExportRequest;
    } catch {
      return errorResponse("Ogiltig förfrågan.", 400);
    }

    if (!body.listing_id) {
      return errorResponse("Annons-id saknas.", 400);
    }

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

    const buffer = await buildListingDocx({
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
    });

    const filename = buildExportFilename((listing.address as string) ?? "export");
    const fileBytes = Uint8Array.from(buffer);

    return new Response(fileBytes, {
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
    if (error instanceof AuthError || error instanceof SubscriptionError) {
      return errorResponse(error.message, error.status);
    }
    console.error("export-listing: unexpected error", error);
    return errorResponse("Exporten misslyckades. Försök igen om en stund.", 500);
  }
});
