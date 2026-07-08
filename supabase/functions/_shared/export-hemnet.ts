import type { ListingExportData } from "./export-docx.ts";

function formatNumber(value: number): string {
  return new Intl.NumberFormat("sv-SE").format(value);
}

function objectFacts(data: ListingExportData): string[] {
  const lines: string[] = [];
  if (data.propertyTypeLabel) lines.push(`Objekttyp: ${data.propertyTypeLabel}`);
  if (data.rooms !== null) lines.push(`Antal rum: ${data.rooms}`);
  if (data.areaSqm !== null) lines.push(`Boarea: ${data.areaSqm} m²`);
  if (data.supplementaryAreaSqm !== null) {
    lines.push(`Biarea: ${data.supplementaryAreaSqm} m²`);
  }
  if (data.plotAreaSqm !== null) lines.push(`Tomtarea: ${formatNumber(data.plotAreaSqm)} m²`);
  if (data.price !== null) lines.push(`Pris: ${formatNumber(data.price)} kr`);
  if (data.monthlyFee !== null) lines.push(`Avgift: ${formatNumber(data.monthlyFee)} kr/mån`);
  if (data.operatingCost !== null) {
    lines.push(`Driftkostnad: ${formatNumber(data.operatingCost)} kr/mån`);
  }
  if (data.buildYear !== null) lines.push(`Byggår: ${data.buildYear}`);
  return lines;
}

/** Plain-text export formatted for pasting into Hemnet. */
export function buildHemnetText(data: ListingExportData): string {
  const { generatedText } = data;
  const sections: string[] = [];

  if (generatedText.headline?.trim()) {
    sections.push(generatedText.headline.trim());
  }

  if (generatedText.body?.trim()) {
    sections.push(generatedText.body.trim());
  }

  const facts = objectFacts(data);
  if (generatedText.facts?.trim()) {
    const aiFacts = generatedText.facts
      .split("\n")
      .map((line) => line.replace(/^[•\-]\s*/, "").trim())
      .filter(Boolean);
    facts.push(...aiFacts);
  }

  if (facts.length > 0) {
    sections.push(facts.map((line) => `• ${line}`).join("\n"));
  }

  return sections.join("\n\n");
}

export function buildHemnetFilename(address: string): string {
  const slug = address
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

  return `hemnet-${slug || "export"}.txt`;
}
