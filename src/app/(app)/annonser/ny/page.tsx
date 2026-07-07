import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { NewListingForm } from "@/components/listings/new-listing-form";
import { requireSession } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Ny annons",
};

export default async function NewListingPage() {
  const { userId, organization } = await requireSession();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ny annons</h1>
        <p className="text-sm text-muted-foreground">
          Fyll i objektets uppgifter. Efter att utkastet sparats genereras annonstexten
          automatiskt – du kan sedan justera och generera om varje del.
        </p>
      </div>
      <Card>
        <CardContent className="pt-6">
          <NewListingForm organizationId={organization.id} userId={userId} />
        </CardContent>
      </Card>
    </div>
  );
}
