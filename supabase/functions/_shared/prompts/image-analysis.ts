/**
 * Versioned prompt logic for property image analysis (Claude vision).
 * Bump IMAGE_PROMPT_VERSION when the analysis schema or tone changes.
 */

export const IMAGE_PROMPT_VERSION = "1.0.0";

export interface ImageAnalysis {
  room_type: string;
  light: string;
  condition: string;
  materials: string[];
  notable_details: string[];
  summary: string;
}

export const IMAGE_ANALYSIS_SYSTEM_PROMPT = `Du är expert på svensk bostadsfotografering och objektbeskrivningar för
fastighetsmäklare. Du analyserar bilder från bostadsobjekt inför
annonsskrivning.

Analysera bilden och svara ENDAST med ett giltigt JSON-objekt enligt exakt
detta schema – ingen annan text, inga markdown-kodblock:

{
  "room_type": "vilken typ av rum/vy bilden visar, t.ex. kök, vardagsrum, sovrum, badrum, hall, balkong, fasad, trädgård, utsikt",
  "light": "kort beskrivning av ljusinsläppet, t.ex. 'generöst dagsljus från stora fönster i två väderstreck'",
  "condition": "kort bedömning av skicket, t.ex. 'nyrenoverat', 'gott skick', 'originalskick', 'renoveringsbehov'",
  "materials": ["synliga materialval, t.ex. 'ekparkett', 'kalksten', 'vitmålade väggar'"],
  "notable_details": ["notabla säljbara detaljer, t.ex. 'öppen spis', 'platsbyggd bokhylla', 'havsutsikt', 'golvvärme (synlig termostat)'"],
  "summary": "1–2 meningar på svenska som sammanfattar vad bilden visar och vad som är mest säljbart"
}

Regler:
- Beskriv ENDAST det som faktiskt syns i bilden. Gissa aldrig om sådant
  som inte syns.
- Var konkret: "vit köksinredning med träbänkskiva" är bättre än "fint kök".
- Om bilden är otydlig eller inte visar en bostad, sätt room_type till
  "okänd" och beskriv kort vad som syns.
- Alla värden ska vara på svenska.`;

export const IMAGE_ANALYSIS_USER_PROMPT =
  "Analysera denna bild från ett bostadsobjekt enligt schemat.";

/**
 * Parses and sanitizes the model's JSON response into an ImageAnalysis.
 * Throws if the payload cannot be interpreted at all.
 */
export function parseImageAnalysis(raw: string): ImageAnalysis {
  // Strip markdown fences if the model added them despite instructions.
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("no JSON object in model response");
  }

  const parsed = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;

  const asString = (value: unknown): string =>
    typeof value === "string" ? value.trim() : "";
  const asStringArray = (value: unknown): string[] =>
    Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim())
      : [];

  return {
    room_type: asString(parsed.room_type) || "okänd",
    light: asString(parsed.light),
    condition: asString(parsed.condition),
    materials: asStringArray(parsed.materials),
    notable_details: asStringArray(parsed.notable_details),
    summary: asString(parsed.summary),
  };
}
