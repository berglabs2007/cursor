/**
 * Builds a formatted Word document (.docx) for a property listing.
 * Used by the export-listing Edge Function.
 */
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "npm:docx@9.5.1";

interface GeneratedText {
  headline?: string;
  body?: string;
  facts?: string;
}

export interface ListingExportData {
  address: string;
  organizationName: string;
  propertyTypeLabel: string;
  rooms: number | null;
  areaSqm: number | null;
  supplementaryAreaSqm: number | null;
  plotAreaSqm: number | null;
  price: number | null;
  monthlyFee: number | null;
  operatingCost: number | null;
  buildYear: number | null;
  generatedText: GeneratedText;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("sv-SE").format(value);
}

function factLine(label: string, value: string | null): Paragraph | null {
  if (!value) return null;
  return new Paragraph({
    spacing: { after: 80 },
    children: [
      new TextRun({ text: `${label}: `, bold: true }),
      new TextRun({ text: value }),
    ],
  });
}

function bodyParagraphs(text: string): Paragraph[] {
  return text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map(
      (block) =>
        new Paragraph({
          spacing: { after: 200, line: 360 },
          children: [new TextRun({ text: block, size: 24 })],
        })
    );
}

function factsParagraphs(text: string): Paragraph[] {
  const lines = text
    .split("\n")
    .map((line) => line.replace(/^[•\-]\s*/, "").trim())
    .filter(Boolean);

  return lines.map(
    (line) =>
      new Paragraph({
        spacing: { after: 80 },
        bullet: { level: 0 },
        children: [new TextRun({ text: line, size: 22 })],
      })
  );
}

export async function buildListingDocx(data: ListingExportData): Promise<Uint8Array> {
  const { generatedText } = data;
  const exportedAt = new Date().toLocaleDateString("sv-SE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const objectFacts: Paragraph[] = [
    factLine("Objekttyp", data.propertyTypeLabel),
    factLine("Antal rum", data.rooms !== null ? String(data.rooms) : null),
    factLine("Boarea", data.areaSqm !== null ? `${data.areaSqm} m²` : null),
    factLine(
      "Biarea",
      data.supplementaryAreaSqm !== null ? `${data.supplementaryAreaSqm} m²` : null
    ),
    factLine(
      "Tomtarea",
      data.plotAreaSqm !== null ? `${formatNumber(data.plotAreaSqm)} m²` : null
    ),
    factLine("Pris", data.price !== null ? `${formatNumber(data.price)} kr` : null),
    factLine(
      "Avgift",
      data.monthlyFee !== null ? `${formatNumber(data.monthlyFee)} kr/mån` : null
    ),
    factLine(
      "Driftkostnad",
      data.operatingCost !== null ? `${formatNumber(data.operatingCost)} kr/mån` : null
    ),
    factLine("Byggår", data.buildYear !== null ? String(data.buildYear) : null),
  ].filter((paragraph): paragraph is Paragraph => paragraph !== null);

  const contentSections: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
      children: [new TextRun({ text: data.address || "Bostadsannons", bold: true })],
    }),
    new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: data.organizationName,
          color: "666666",
          size: 20,
        }),
      ],
    }),
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 240, after: 160 },
      children: [new TextRun({ text: "Objektsuppgifter" })],
    }),
    ...objectFacts,
  ];

  if (generatedText.headline?.trim()) {
    contentSections.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 360, after: 160 },
        children: [new TextRun({ text: "Rubrik (Hemnet)" })],
      }),
      new Paragraph({
        spacing: { after: 240 },
        children: [
          new TextRun({
            text: generatedText.headline.trim(),
            bold: true,
            size: 28,
          }),
        ],
      })
    );
  }

  if (generatedText.body?.trim()) {
    contentSections.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 360, after: 160 },
        children: [new TextRun({ text: "Säljande löptext" })],
      }),
      ...bodyParagraphs(generatedText.body)
    );
  }

  if (generatedText.facts?.trim()) {
    contentSections.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 360, after: 160 },
        children: [new TextRun({ text: "Objektsfakta" })],
      }),
      ...factsParagraphs(generatedText.facts)
    );
  }

  contentSections.push(
    new Paragraph({
      spacing: { before: 480 },
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `Exporterad från BergLabs · ${exportedAt}`,
          color: "999999",
          size: 18,
          italics: true,
        }),
      ],
    })
  );

  const document = new Document({
    sections: [{ properties: {}, children: contentSections }],
  });

  return await Packer.toBuffer(document);
}

/** Safe filename from address, e.g. "annons-storgatan-12.docx". */
export function buildExportFilename(address: string): string {
  const slug = address
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

  return `annons-${slug || "export"}.docx`;
}
