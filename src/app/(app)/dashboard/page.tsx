import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Annonser",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Utkast",
  final: "Klar",
};

export default async function DashboardPage() {
  const { organization } = await requireSession();
  const supabase = await createClient();

  const { data: listings } = await supabase
    .from("listings")
    .select("id, address, property_type, status, updated_at")
    .order("updated_at", { ascending: false })
    .limit(20);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Annonser</h1>
          <p className="text-sm text-muted-foreground">{organization.name}</p>
        </div>
        <Button asChild>
          <Link href="/annonser/ny">
            <Plus className="size-4" />
            Ny annons
          </Link>
        </Button>
      </div>

      {!listings || listings.length === 0 ? (
        <Card>
          <CardHeader className="items-center text-center">
            <FileText className="mx-auto size-8 text-muted-foreground" />
            <CardTitle>Inga annonser ännu</CardTitle>
            <CardDescription>
              Skapa din första annons så genererar BergLabs en säljande text utifrån
              objektets fakta och bilder.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button asChild>
              <Link href="/annonser/ny">
                <Plus className="size-4" />
                Skapa annons
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {listings.map((listing) => (
            <Link key={listing.id} href={`/annonser/${listing.id}`}>
              <Card className="transition-colors hover:bg-secondary/40">
                <CardContent className="flex items-center justify-between gap-4 py-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {listing.address || "Annons utan adress"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Uppdaterad{" "}
                      {new Date(listing.updated_at).toLocaleDateString("sv-SE", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <Badge variant={listing.status === "final" ? "default" : "secondary"}>
                    {STATUS_LABELS[listing.status] ?? listing.status}
                  </Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
