"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import {
  PROPERTY_TYPE_OPTIONS,
  TARGET_AUDIENCE_OPTIONS,
  TONE_OPTIONS,
} from "@/lib/listing-constants";
import type {
  Listing,
  ListingTone,
  PropertyType,
  TargetAudience,
  TablesUpdate,
} from "@/lib/database.types";

interface ListingFormValues {
  address: string;
  property_type: PropertyType;
  rooms: string;
  area_sqm: string;
  supplementary_area_sqm: string;
  plot_area_sqm: string;
  price: string;
  monthly_fee: string;
  operating_cost: string;
  build_year: string;
  key_features: string;
  target_audience: TargetAudience | "none";
  tone: ListingTone;
}

interface ListingFormProps {
  /** Existing listing when editing; omitted when creating. */
  listing?: Listing;
  /** Needed for inserts – RLS verifies both against the session. */
  organizationId?: string;
  userId?: string;
  submitLabel: string;
  onSaved: (listingId: string) => void;
}

function toFormValue(value: number | null): string {
  return value === null ? "" : String(value);
}

function initialValues(listing?: Listing): ListingFormValues {
  return {
    address: listing?.address ?? "",
    property_type: listing?.property_type ?? "apartment",
    rooms: toFormValue(listing?.rooms ?? null),
    area_sqm: toFormValue(listing?.area_sqm ?? null),
    supplementary_area_sqm: toFormValue(listing?.supplementary_area_sqm ?? null),
    plot_area_sqm: toFormValue(listing?.plot_area_sqm ?? null),
    price: toFormValue(listing?.price ?? null),
    monthly_fee: toFormValue(listing?.monthly_fee ?? null),
    operating_cost: toFormValue(listing?.operating_cost ?? null),
    build_year: toFormValue(listing?.build_year ?? null),
    key_features: listing?.key_features ?? "",
    target_audience: listing?.target_audience ?? "none",
    tone: listing?.tone ?? "classic",
  };
}

function parseOptionalNumber(
  raw: string,
  label: string,
  options?: { integer?: boolean; min?: number; max?: number }
): { value: number | null; error?: string } {
  const trimmed = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!trimmed) return { value: null };

  const parsed = Number(trimmed);
  if (Number.isNaN(parsed)) {
    return { value: null, error: `${label} måste vara ett tal.` };
  }
  if (options?.integer && !Number.isInteger(parsed)) {
    return { value: null, error: `${label} måste vara ett heltal.` };
  }
  if (options?.min !== undefined && parsed < options.min) {
    return { value: null, error: `${label} måste vara minst ${options.min}.` };
  }
  if (options?.max !== undefined && parsed > options.max) {
    return { value: null, error: `${label} får vara högst ${options.max}.` };
  }
  return { value: parsed };
}

export function ListingForm({
  listing,
  organizationId,
  userId,
  submitLabel,
  onSaved,
}: ListingFormProps) {
  const [values, setValues] = useState<ListingFormValues>(() => initialValues(listing));
  const [isSaving, setIsSaving] = useState(false);

  function setField<K extends keyof ListingFormValues>(key: K, value: ListingFormValues[K]) {
    setValues((previous) => ({ ...previous, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!values.address.trim()) {
      toast.error("Ange objektets adress.");
      return;
    }

    const numberFields = [
      ["rooms", parseOptionalNumber(values.rooms, "Antal rum", { min: 0.5, max: 99 })],
      ["area_sqm", parseOptionalNumber(values.area_sqm, "Boarea", { min: 1 })],
      [
        "supplementary_area_sqm",
        parseOptionalNumber(values.supplementary_area_sqm, "Biarea", { min: 0 }),
      ],
      ["plot_area_sqm", parseOptionalNumber(values.plot_area_sqm, "Tomtarea", { min: 0 })],
      ["price", parseOptionalNumber(values.price, "Pris", { integer: true, min: 0 })],
      ["monthly_fee", parseOptionalNumber(values.monthly_fee, "Avgift", { integer: true, min: 0 })],
      [
        "operating_cost",
        parseOptionalNumber(values.operating_cost, "Driftkostnad", { integer: true, min: 0 }),
      ],
      [
        "build_year",
        parseOptionalNumber(values.build_year, "Byggår", {
          integer: true,
          min: 1500,
          max: 2100,
        }),
      ],
    ] as const;

    for (const [, result] of numberFields) {
      if (result.error) {
        toast.error(result.error);
        return;
      }
    }

    const parsed = Object.fromEntries(
      numberFields.map(([key, result]) => [key, result.value])
    ) as Record<(typeof numberFields)[number][0], number | null>;

    const payload: TablesUpdate<"listings"> = {
      address: values.address.trim(),
      property_type: values.property_type,
      rooms: parsed.rooms,
      area_sqm: parsed.area_sqm,
      supplementary_area_sqm: parsed.supplementary_area_sqm,
      plot_area_sqm: parsed.plot_area_sqm,
      price: parsed.price,
      monthly_fee: parsed.monthly_fee,
      operating_cost: parsed.operating_cost,
      build_year: parsed.build_year,
      key_features: values.key_features.trim(),
      target_audience: values.target_audience === "none" ? null : values.target_audience,
      tone: values.tone,
    };

    setIsSaving(true);
    const supabase = createClient();

    if (listing) {
      const { error } = await supabase.from("listings").update(payload).eq("id", listing.id);
      setIsSaving(false);
      if (error) {
        toast.error("Kunde inte spara ändringarna. Försök igen – dina uppgifter finns kvar.");
        return;
      }
      onSaved(listing.id);
      return;
    }

    if (!organizationId || !userId) {
      setIsSaving(false);
      toast.error("Sessionen kunde inte verifieras. Ladda om sidan och försök igen.");
      return;
    }

    const { data, error } = await supabase
      .from("listings")
      .insert({ ...payload, organization_id: organizationId, created_by: userId })
      .select("id")
      .single();

    setIsSaving(false);

    if (error || !data) {
      toast.error("Kunde inte skapa annonsen. Försök igen – dina uppgifter finns kvar.");
      return;
    }

    onSaved(data.id);
  }

  const showPlotArea = values.property_type !== "apartment";
  const showMonthlyFee = values.property_type === "apartment";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="address">Adress</Label>
          <Input
            id="address"
            placeholder="Storgatan 12, Sundsvall"
            value={values.address}
            onChange={(e) => setField("address", e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="propertyType">Objektstyp</Label>
          <Select
            value={values.property_type}
            onValueChange={(value) => setField("property_type", value as PropertyType)}
          >
            <SelectTrigger id="propertyType" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROPERTY_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="rooms">Antal rum</Label>
          <Input
            id="rooms"
            inputMode="decimal"
            placeholder="3"
            value={values.rooms}
            onChange={(e) => setField("rooms", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="areaSqm">Boarea (m²)</Label>
          <Input
            id="areaSqm"
            inputMode="decimal"
            placeholder="78"
            value={values.area_sqm}
            onChange={(e) => setField("area_sqm", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="supplementaryAreaSqm">
            Biarea (m²) <span className="text-muted-foreground">(valfritt)</span>
          </Label>
          <Input
            id="supplementaryAreaSqm"
            inputMode="decimal"
            value={values.supplementary_area_sqm}
            onChange={(e) => setField("supplementary_area_sqm", e.target.value)}
          />
        </div>

        {showPlotArea ? (
          <div className="space-y-2">
            <Label htmlFor="plotAreaSqm">
              Tomtarea (m²) <span className="text-muted-foreground">(valfritt)</span>
            </Label>
            <Input
              id="plotAreaSqm"
              inputMode="decimal"
              value={values.plot_area_sqm}
              onChange={(e) => setField("plot_area_sqm", e.target.value)}
            />
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="price">Pris/utgångspris (kr)</Label>
          <Input
            id="price"
            inputMode="numeric"
            placeholder="2450000"
            value={values.price}
            onChange={(e) => setField("price", e.target.value)}
          />
        </div>

        {showMonthlyFee ? (
          <div className="space-y-2">
            <Label htmlFor="monthlyFee">
              Avgift (kr/mån) <span className="text-muted-foreground">(valfritt)</span>
            </Label>
            <Input
              id="monthlyFee"
              inputMode="numeric"
              value={values.monthly_fee}
              onChange={(e) => setField("monthly_fee", e.target.value)}
            />
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="operatingCost">
            Driftkostnad (kr/mån) <span className="text-muted-foreground">(valfritt)</span>
          </Label>
          <Input
            id="operatingCost"
            inputMode="numeric"
            value={values.operating_cost}
            onChange={(e) => setField("operating_cost", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="buildYear">
            Byggår <span className="text-muted-foreground">(valfritt)</span>
          </Label>
          <Input
            id="buildYear"
            inputMode="numeric"
            placeholder="1962"
            value={values.build_year}
            onChange={(e) => setField("build_year", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="targetAudience">
            Målgrupp <span className="text-muted-foreground">(valfritt)</span>
          </Label>
          <Select
            value={values.target_audience}
            onValueChange={(value) =>
              setField("target_audience", value as TargetAudience | "none")
            }
          >
            <SelectTrigger id="targetAudience" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Ingen särskild</SelectItem>
              {TARGET_AUDIENCE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="keyFeatures">Unika säljpunkter</Label>
          <Textarea
            id="keyFeatures"
            rows={4}
            placeholder={
              "T.ex. nyrenoverat kök 2023, öppen spis, kvällssol på balkongen, 200 m till pendeltåget…"
            }
            value={values.key_features}
            onChange={(e) => setField("key_features", e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Skriv fritt – AI:n väver in punkterna i texten. En punkt per rad går bra.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <Label>Ton i annonsen</Label>
        <RadioGroup
          value={values.tone}
          onValueChange={(value) => setField("tone", value as ListingTone)}
          className="grid gap-3 sm:grid-cols-3"
        >
          {TONE_OPTIONS.map((option) => (
            <Label
              key={option.value}
              htmlFor={`tone-${option.value}`}
              className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-secondary/50"
            >
              <RadioGroupItem
                id={`tone-${option.value}`}
                value={option.value}
                className="mt-0.5"
              />
              <span className="space-y-1">
                <span className="block text-sm font-medium">{option.label}</span>
                <span className="block text-xs font-normal text-muted-foreground">
                  {option.description}
                </span>
              </span>
            </Label>
          ))}
        </RadioGroup>
      </div>

      <Button type="submit" disabled={isSaving} className="w-full sm:w-auto">
        {isSaving ? "Sparar…" : submitLabel}
      </Button>
    </form>
  );
}
