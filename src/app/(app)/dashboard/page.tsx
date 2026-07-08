import type { Metadata } from "next";
import { DashboardList } from "@/components/dashboard/dashboard-list";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Annonser",
};

export default async function DashboardPage() {
  const { organization, profile } = await requireSession();
  const supabase = await createClient();

  const { data: listings } = await supabase
    .from("listings")
    .select("id, address, property_type, status, updated_at")
    .eq("created_by", profile.id)
    .order("updated_at", { ascending: false });

  return (
    <DashboardList organizationName={organization.name} listings={listings ?? []} />
  );
}
