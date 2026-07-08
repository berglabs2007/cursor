import { AnthropicError, completeClaude } from "./anthropic.ts";
import type { ListingExportData } from "./export-docx.ts";

export interface SocialCaptionVariant {
  label: string;
  caption: string;
}

export interface SocialCaptionsResult {
  instagram: SocialCaptionVariant[];
  facebook: SocialCaptionVariant[];
}

const SYSTEM_PROMPT =
  "Du är en svensk social media-copywriter för bostadsmäklare. " +
  "Skriv captions som känns nativa för respektive plattform. " +
  "Bevara fakta (siffror, adresser, m²). Skriv på svenska. " +
  "Returnera ENDAST giltig JSON utan markdown-kodblock, enligt detta schema:\n" +
  `{"instagram":[{"label":"Engagerande","caption":"..."},{"label":"Informativ","caption":"..."},{"label":"Emojitung","caption":"..."}],` +
  `"facebook":[{"label":"Säljande","caption":"..."},{"label":"Informativ","caption":"..."}]}\n\n` +
  "Instagram: 3 varianter med unik hook, max 150 ord, 8–15 hashtags sist. " +
  "Facebook: 2 längre varianter med ✔-listor, konversationell ton, inga hashtags.";

export async function generateSocialCaptions(
  data: ListingExportData
): Promise<SocialCaptionsResult> {
  const listingSummary = {
    address: data.address,
    organization: data.organizationName,
    property_type: data.propertyTypeLabel,
    rooms: data.rooms,
    area_sqm: data.areaSqm,
    price: data.price,
    headline: data.generatedText.headline,
    body: data.generatedText.body,
    facts: data.generatedText.facts,
  };

  const raw = await completeClaude({
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Generera sociala medier-captions för denna bostad:\n${JSON.stringify(listingSummary, null, 2)}`,
      },
    ],
    maxTokens: 4096,
    temperature: 0.8,
    timeoutMs: 90_000,
  });

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new AnthropicError("Kunde inte generera captions. Försök igen.", 502);
  }

  let parsed: SocialCaptionsResult;
  try {
    parsed = JSON.parse(jsonMatch[0]) as SocialCaptionsResult;
  } catch {
    throw new AnthropicError("Kunde inte tolka AI-svaret. Försök igen.", 502);
  }

  if (!parsed.instagram?.length || !parsed.facebook?.length) {
    throw new AnthropicError("Ofullständigt svar från AI. Försök igen.", 502);
  }

  return parsed;
}
