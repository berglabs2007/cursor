"use client";

import { useRouter } from "next/navigation";
import { ListingForm } from "@/components/listings/listing-form";

interface NewListingFormProps {
  organizationId: string;
  userId: string;
}

export function NewListingForm({ organizationId, userId }: NewListingFormProps) {
  const router = useRouter();

  return (
    <ListingForm
      organizationId={organizationId}
      userId={userId}
      submitLabel="Spara och generera annonstext"
      onSaved={(listingId) => {
        router.push(`/annonser/${listingId}?generera=1`);
      }}
    />
  );
}
