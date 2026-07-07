import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Handles email links (invite, recovery, email confirmation) by
 * verifying the token hash and redirecting to the right page.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/dashboard";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

    if (!error) {
      if (type === "invite") {
        return NextResponse.redirect(`${origin}/uppdatera-losenord?valkommen=1`);
      }
      if (type === "recovery") {
        return NextResponse.redirect(`${origin}/uppdatera-losenord`);
      }
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("Länken är ogiltig eller har gått ut. Be om en ny länk.")}`
  );
}
