import type {
  ListingTone,
  PropertyType,
  TargetAudience,
} from "@/lib/database.types";

export const PROPERTY_TYPE_OPTIONS: Array<{ value: PropertyType; label: string }> = [
  { value: "villa", label: "Villa" },
  { value: "apartment", label: "Lägenhet" },
  { value: "townhouse", label: "Radhus" },
  { value: "vacation_home", label: "Fritidshus" },
];

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> =
  Object.fromEntries(
    PROPERTY_TYPE_OPTIONS.map((option) => [option.value, option.label])
  ) as Record<PropertyType, string>;

export const TONE_OPTIONS: Array<{
  value: ListingTone;
  label: string;
  description: string;
}> = [
  {
    value: "classic",
    label: "Klassisk/saklig",
    description: "Förtroendeingivande och korrekt – låter objektet tala för sig självt.",
  },
  {
    value: "warm",
    label: "Varm/personlig",
    description: "Närvarande och målande – vardagen i bostaden står i centrum.",
  },
  {
    value: "luxury",
    label: "Lyxig/exklusiv",
    description: "Avskalat och självsäkert – hantverk, material och läge i fokus.",
  },
];

export const TARGET_AUDIENCE_OPTIONS: Array<{
  value: TargetAudience;
  label: string;
}> = [
  { value: "family", label: "Familj" },
  { value: "first_time_buyer", label: "Förstagångsköpare" },
  { value: "investor", label: "Investerare" },
];

export const STATUS_LABELS: Record<string, string> = {
  draft: "Utkast",
  final: "Klar",
};
