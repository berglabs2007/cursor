/**
 * Versioned prompt logic for listing text generation.
 *
 * This file is the single source of truth for how BergLabs talks to
 * Claude. Bump PROMPT_VERSION whenever the tone or structure changes
 * so generations can be traced to a prompt revision.
 */

export const PROMPT_VERSION = "1.0.0";

export type GenerationPart = "headline" | "body" | "facts";
export type Tone = "classic" | "warm" | "luxury";
export type TargetAudience = "family" | "first_time_buyer" | "investor";

export const GENERATION_PARTS: GenerationPart[] = ["headline", "body", "facts"];

export const PART_MAX_TOKENS: Record<GenerationPart, number> = {
  headline: 200,
  body: 1200,
  facts: 800,
};

export interface ListingPromptData {
  address: string;
  property_type: string;
  rooms: number | null;
  area_sqm: number | null;
  supplementary_area_sqm: number | null;
  plot_area_sqm: number | null;
  price: number | null;
  monthly_fee: number | null;
  operating_cost: number | null;
  build_year: number | null;
  key_features: string;
  target_audience: TargetAudience | null;
  tone: Tone;
}

export interface ImageFinding {
  room_type: string;
  light: string;
  condition: string;
  materials: string[];
  notable_details: string[];
  summary: string;
}

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  villa: "Villa",
  apartment: "Lägenhet",
  townhouse: "Radhus",
  vacation_home: "Fritidshus",
};

const TONE_INSTRUCTIONS: Record<Tone, string> = {
  classic: `TON: Klassisk och saklig.
Skriv förtroendeingivande och korrekt, som en etablerad byrå med lång historia.
Låt objektets kvaliteter tala för sig själva. Beskriv snarare än värdera.
Adjektiv används sparsamt och bara när de är motiverade av underlaget.`,
  warm: `TON: Varm och personlig.
Skriv med värme och närvaro, som om du själv gått genom bostaden och vill
berätta om den för en god vän. Måla upp vardagen i bostaden – morgonljuset i
köket, kvällarna på balkongen – men bara utifrån det som faktiskt finns i
underlaget. Behåll professionell nivå; varm betyder inte pratig.`,
  luxury: `TON: Exklusiv och sofistikerad.
Skriv för ett premiumsegment. Betona hantverk, materialval, arkitektur och
läge. Använd ett avskalat, självsäkert språk – exklusivitet visas genom
precision och återhållsamhet, inte genom staplade superlativ. Ord som
"lyxig" och "exklusiv" undviks; kvaliteten ska framgå av detaljerna.`,
};

const AUDIENCE_INSTRUCTIONS: Record<TargetAudience, string> = {
  family: `MÅLGRUPP: Barnfamiljer.
Lyft det som är relevant för familjeliv när underlaget stödjer det: antal
sovrum, förvaring, närhet till skola och grönområden, säker utemiljö,
sällskapsytor. Överdriv inte – nämn bara det som finns i underlaget.`,
  first_time_buyer: `MÅLGRUPP: Förstagångsköpare.
Lyft det som sänker tröskeln in på bostadsmarknaden när underlaget stödjer
det: pris och avgift i relation till läget, skick som inte kräver åtgärder,
smart planlösning på liten yta, kommunikationer.`,
  investor: `MÅLGRUPP: Investerare.
Skriv mer faktaorienterat: skick, byggår, driftkostnader, avgift,
uthyrningsbarhet och läge. Tona ned känslomässiga beskrivningar till förmån
för substans.`,
};

const BASE_SYSTEM_PROMPT = `Du är en av Sveriges skickligaste copywriters för bostadsannonser, med
femton års erfarenhet från etablerade mäklarbyråer. Dina texter håller samma
klass som de bästa annonserna på Hemnet från byråer som funnits i decennier:
säljande men trovärdiga, konkreta och fria från floskler.

ABSOLUTA REGLER – gäller allt du skriver:
1. Använd ENDAST fakta som finns i underlaget. Hitta aldrig på rum,
   renoveringar, utsikter, avstånd eller egenskaper som inte nämns.
2. Skriv naturlig, idiomatisk svenska med korrekt grammatik.
3. Undvik AI-klyschor och slitna mäklarfraser, till exempel: "unik möjlighet",
   "drömboende", "en oas", "i hjärtat av", "andas", "bjuder in till",
   "det lilla extra", "smakfullt renoverad" (utan konkretion), "läge läge läge".
4. Max ett utropstecken i hela texten – helst inget.
5. Skriv tal enligt svensk konvention: 2 450 000 kr, 85 m², 3 500 kr/mån.
6. Värdera inte det du inte kan belägga: skriv "kök från 2021" hellre än
   "toppmodernt kök" om underlaget bara anger årtal.
7. Om ett fält saknas i underlaget – utelämna det, kommentera aldrig att
   information saknas.
8. Svara alltid enbart med den efterfrågade texten – ingen inledning,
   inga rubriketiketter, inga förklaringar, inga citattecken runt svaret.`;

/**
 * Builds the system prompt from the versioned base + tone + audience.
 * The tone selector in the UI maps directly to these instructions.
 */
export function buildSystemPrompt(
  tone: Tone,
  targetAudience: TargetAudience | null
): string {
  const sections = [BASE_SYSTEM_PROMPT, TONE_INSTRUCTIONS[tone]];
  if (targetAudience) {
    sections.push(AUDIENCE_INSTRUCTIONS[targetAudience]);
  }
  return sections.join("\n\n");
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("sv-SE").format(value);
}

/**
 * Serializes listing data + confirmed image findings into the fact
 * sheet that every part prompt is grounded in.
 */
export function buildFactSheet(
  listing: ListingPromptData,
  imageFindings: ImageFinding[]
): string {
  const lines: string[] = [];
  const add = (label: string, value: string | null) => {
    if (value) lines.push(`${label}: ${value}`);
  };

  add("Adress", listing.address);
  add("Objektstyp", PROPERTY_TYPE_LABELS[listing.property_type] ?? listing.property_type);
  add("Antal rum", listing.rooms !== null ? `${listing.rooms} rum` : null);
  add("Boarea", listing.area_sqm !== null ? `${listing.area_sqm} m²` : null);
  add(
    "Biarea",
    listing.supplementary_area_sqm !== null ? `${listing.supplementary_area_sqm} m²` : null
  );
  add("Tomtarea", listing.plot_area_sqm !== null ? `${formatNumber(listing.plot_area_sqm)} m²` : null);
  add("Pris/utgångspris", listing.price !== null ? `${formatNumber(listing.price)} kr` : null);
  add("Avgift", listing.monthly_fee !== null ? `${formatNumber(listing.monthly_fee)} kr/mån` : null);
  add(
    "Driftkostnad",
    listing.operating_cost !== null ? `${formatNumber(listing.operating_cost)} kr/mån` : null
  );
  add("Byggår", listing.build_year !== null ? String(listing.build_year) : null);

  if (listing.key_features.trim()) {
    lines.push(`Mäklarens egna säljpunkter:\n${listing.key_features.trim()}`);
  }

  if (imageFindings.length > 0) {
    const findingLines = imageFindings.map((finding) => {
      const details = [
        finding.summary,
        finding.notable_details.length > 0
          ? `Notabelt: ${finding.notable_details.join(", ")}`
          : "",
      ]
        .filter(Boolean)
        .join(" ");
      return `- ${finding.room_type}: ${details}`;
    });
    lines.push(
      `Observationer från bildanalys (bekräftade av mäklaren):\n${findingLines.join("\n")}`
    );
  }

  return lines.join("\n");
}

const PART_INSTRUCTIONS: Record<GenerationPart, string> = {
  headline: `UPPGIFT: Skriv EN kort rubrikrad för Hemnet.
- Max 60 tecken.
- Ta INTE med adressen (den visas separat på Hemnet).
- Fånga objektets starkaste säljpunkt ur underlaget.
- Ingen punkt i slutet.`,
  body: `UPPGIFT: Skriv annonsens säljande löptext.
- 150–300 ord.
- Dela upp i 2–4 stycken med tomrad mellan.
- Inled med det som gör bostaden mest attraktiv – inte med adressen
  eller "Välkommen till".
- Väv in läge, planlösning, material och ljus i en naturlig ordning.
- Avsluta med en kort, konkret rad om visning eller kontakt utan
  klyschor.`,
  facts: `UPPGIFT: Skriv en kort objektsfakta-sammanfattning.
- Punktlista där varje rad börjar med "• ".
- En kort rad per punkt: objektstyp, rum, ytor, pris, avgift/drift,
  byggår samt 2–4 utmärkande egenskaper ur underlaget.
- Endast fakta, inga säljande formuleringar.`,
};

export interface ExistingParts {
  headline?: string;
  body?: string;
  facts?: string;
}

/**
 * Builds the user prompt for one part. When a single part is
 * regenerated, the other existing parts are provided as context so the
 * result stays consistent with what the agent is keeping.
 */
export function buildPartPrompt(
  part: GenerationPart,
  factSheet: string,
  existingParts: ExistingParts
): string {
  const sections = [
    PART_INSTRUCTIONS[part],
    `UNDERLAG OM BOSTADEN:\n${factSheet}`,
  ];

  const context: string[] = [];
  if (part !== "headline" && existingParts.headline) {
    context.push(`Befintlig rubrik (behålls): ${existingParts.headline}`);
  }
  if (part !== "body" && existingParts.body) {
    context.push(`Befintlig löptext (behålls):\n${existingParts.body}`);
  }
  if (part !== "facts" && existingParts.facts) {
    context.push(`Befintlig objektsfakta (behålls):\n${existingParts.facts}`);
  }
  if (context.length > 0) {
    sections.push(
      `KONTEXT – följande delar av annonsen behålls oförändrade. Skriv din del så att den stämmer överens med dem:\n${context.join("\n\n")}`
    );
  }

  return sections.join("\n\n");
}
