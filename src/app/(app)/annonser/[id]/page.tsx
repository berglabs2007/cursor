import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListingEditor } from "@/components/listings/listing-editor";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Annons",
};

interface ListingPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ generera?: string }>;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ListingPage({ params, searchParams }: ListingPageProps) {
  await requireSession();

  const { id } = await params;
  const { generera } = await searchParams;

  if (!UUID_PATTERN.test(id)) {
    notFound();
  }

  const supabase = await createClient();

  // RLS guarantees only the caller's organization's listing is returned.
  const [{ data: listing }, { data: versions }, { data: images }] = await Promise.all([
    supabase.from("listings").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("listing_versions")
      .select("*")
      .eq("listing_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("listing_images")
      .select("*")
      .eq("listing_id", id)
      .order("sort_order", { ascending: true }),
  ]);

  if (!listing) {
    notFound();
  }

  return (
    <ListingEditor
      listing={listing}
      images={images ?? []}
      versions={versions ?? []}
      autoStart={generera === "1" && !listing.generated_text}
    />
  );
}
