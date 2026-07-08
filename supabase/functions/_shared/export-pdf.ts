import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
import type { ListingExportData } from "./export-docx.ts";

const MARGIN = 50;
const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const LINE_HEIGHT = 14;

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function buildListingPdf(data: ListingExportData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let y = PAGE_HEIGHT - MARGIN;

  function ensureSpace(lines: number) {
    if (y - lines * LINE_HEIGHT < MARGIN) {
      page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
  }

  function drawLine(text: string, bold = false, size = 11) {
    ensureSpace(1);
    page.drawText(text, {
      x: MARGIN,
      y,
      size,
      font: bold ? fontBold : font,
      color: rgb(0.1, 0.1, 0.1),
      maxWidth: CONTENT_WIDTH,
    });
    y -= LINE_HEIGHT + (size > 11 ? 4 : 0);
  }

  drawLine(data.address || "Bostadsannons", true, 18);
  drawLine(data.organizationName, false, 10);
  y -= 8;

  drawLine("Objektsuppgifter", true, 13);
  if (data.propertyTypeLabel) drawLine(`Objekttyp: ${data.propertyTypeLabel}`);
  if (data.rooms !== null) drawLine(`Antal rum: ${data.rooms}`);
  if (data.areaSqm !== null) drawLine(`Boarea: ${data.areaSqm} m²`);
  if (data.price !== null) {
    drawLine(`Pris: ${new Intl.NumberFormat("sv-SE").format(data.price)} kr`);
  }
  y -= 8;

  const { generatedText } = data;

  if (generatedText.headline?.trim()) {
    drawLine("Rubrik", true, 13);
    for (const line of wrapText(generatedText.headline.trim(), 80)) {
      drawLine(line, true, 12);
    }
    y -= 4;
  }

  if (generatedText.body?.trim()) {
    drawLine("Säljande löptext", true, 13);
    for (const paragraph of generatedText.body.split(/\n\s*\n/)) {
      for (const line of wrapText(paragraph.trim(), 90)) {
        drawLine(line);
      }
      y -= 4;
    }
  }

  if (generatedText.facts?.trim()) {
    drawLine("Objektsfakta", true, 13);
    for (const line of generatedText.facts.split("\n")) {
      const cleaned = line.replace(/^[•\-]\s*/, "").trim();
      if (cleaned) drawLine(`• ${cleaned}`);
    }
  }

  const exportedAt = new Date().toLocaleDateString("sv-SE");
  y -= 12;
  drawLine(`Exporterad från BergLabs · ${exportedAt}`, false, 9);

  return await pdf.save();
}

export function buildPdfFilename(address: string): string {
  const slug = address
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

  return `annons-${slug || "export"}.pdf`;
}
