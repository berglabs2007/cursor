"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FileText, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PROPERTY_TYPE_LABELS, STATUS_LABELS } from "@/lib/listing-constants";
import type { ListingStatus, PropertyType } from "@/lib/database.types";

export interface DashboardListing {
  id: string;
  address: string;
  property_type: PropertyType;
  status: ListingStatus;
  updated_at: string;
}

interface DashboardListProps {
  organizationName: string;
  listings: DashboardListing[];
}

type StatusFilter = "all" | ListingStatus;

function formatUpdatedAt(value: string): string {
  return new Date(value).toLocaleDateString("sv-SE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function DashboardList({ organizationName, listings }: DashboardListProps) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return listings.filter((listing) => {
      const matchesStatus = statusFilter === "all" || listing.status === statusFilter;
      const matchesQuery =
        !normalizedQuery ||
        listing.address.toLowerCase().includes(normalizedQuery) ||
        PROPERTY_TYPE_LABELS[listing.property_type].toLowerCase().includes(normalizedQuery);

      return matchesStatus && matchesQuery;
    });
  }, [listings, query, statusFilter]);

  const draftCount = listings.filter((listing) => listing.status === "draft").length;
  const finalCount = listings.filter((listing) => listing.status === "final").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Annonser</h1>
          <p className="text-sm text-muted-foreground">
            {organizationName} · {listings.length} annons{listings.length === 1 ? "" : "er"}
          </p>
        </div>
        <Button asChild>
          <Link href="/annonser/ny">
            <Plus className="size-4" />
            Ny annons
          </Link>
        </Button>
      </div>

      {listings.length === 0 ? (
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
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-md flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Sök på adress eller objektstyp…"
                className="pl-9"
                aria-label="Sök annonser"
              />
            </div>
            <Tabs
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as StatusFilter)}
            >
              <TabsList>
                <TabsTrigger value="all">Alla ({listings.length})</TabsTrigger>
                <TabsTrigger value="draft">Utkast ({draftCount})</TabsTrigger>
                <TabsTrigger value="final">Klara ({finalCount})</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {filtered.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Inga annonser matchar din sökning. Prova ett annat sökord eller filter.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {filtered.map((listing) => (
                <Link key={listing.id} href={`/annonser/${listing.id}`}>
                  <Card className="transition-colors hover:bg-secondary/40">
                    <CardContent className="flex items-center justify-between gap-4 py-4">
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {listing.address || "Annons utan adress"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {PROPERTY_TYPE_LABELS[listing.property_type]} · Uppdaterad{" "}
                          {formatUpdatedAt(listing.updated_at)}
                        </p>
                      </div>
                      <Badge variant={listing.status === "final" ? "default" : "secondary"}>
                        {STATUS_LABELS[listing.status]}
                      </Badge>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
