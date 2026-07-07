import {
  createClient,
  type SupabaseClient,
} from "jsr:@supabase/supabase-js@2";

export interface AuthContext {
  userId: string;
  email: string;
  organizationId: string;
  role: "owner" | "admin" | "agent";
  /** Client bound to the caller's JWT – subject to RLS. */
  supabase: SupabaseClient;
  /** Service-role client – bypasses RLS, use with care. */
  admin: SupabaseClient;
}

export class AuthError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

/**
 * Validates the caller's Supabase session and resolves their
 * organization + role server-side from the profiles table.
 *
 * SECURITY: organization_id is NEVER taken from the request body –
 * always from the authenticated user's profile.
 */
export async function requireAuth(req: Request): Promise<AuthContext> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AuthError("Du är inte inloggad. Logga in och försök igen.", 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new AuthError("Servern är felkonfigurerad. Kontakta support.", 500);
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new AuthError("Din session har gått ut. Logga in igen.", 401);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new AuthError("Kunde inte läsa din profil. Försök igen.", 500);
  }
  if (!profile) {
    throw new AuthError("Ditt konto saknar en organisation.", 403);
  }

  return {
    userId: user.id,
    email: user.email ?? "",
    organizationId: profile.organization_id as string,
    role: profile.role as AuthContext["role"],
    supabase,
    admin,
  };
}

/**
 * Verifies that a listing belongs to the caller's organization.
 * Returns the listing row (service-role read) or throws 404.
 */
export async function requireListingInOrg(
  ctx: AuthContext,
  listingId: string
): Promise<Record<string, unknown>> {
  const { data: listing, error } = await ctx.admin
    .from("listings")
    .select("*")
    .eq("id", listingId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();

  if (error) {
    throw new AuthError("Kunde inte läsa annonsen. Försök igen.", 500);
  }
  if (!listing) {
    throw new AuthError("Annonsen finns inte eller tillhör inte din byrå.", 404);
  }

  return listing;
}
