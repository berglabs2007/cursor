import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Organization, Profile } from "@/lib/database.types";

export interface SessionContext {
  userId: string;
  profile: Profile;
  organization: Organization;
}

/**
 * Loads the authenticated user's profile and organization.
 * Redirects to /login when unauthenticated and to /onboarding when the
 * user has no profile yet (fresh Google sign-in).
 */
export async function requireSession(): Promise<SessionContext> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    redirect("/onboarding");
  }

  const { data: organization } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", profile.organization_id)
    .maybeSingle();

  if (!organization) {
    // Should not happen (FK guarantees the org exists) – treat as logged out.
    redirect("/login");
  }

  return { userId: user.id, profile, organization };
}
