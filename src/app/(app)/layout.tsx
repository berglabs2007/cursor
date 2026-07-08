import Link from "next/link";
import { MainNav } from "@/components/layout/main-nav";
import { UserMenu } from "@/components/layout/user-menu";
import { SubscriptionBanner } from "@/components/billing/subscription-banner";
import { requireSession } from "@/lib/auth";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { profile, organization } = await requireSession();

  return (
    <div className="flex min-h-svh flex-col bg-muted/30">
      <SubscriptionBanner
        subscriptionStatus={organization.subscription_status}
        role={profile.role}
      />
      <header className="sticky top-0 z-40 border-b bg-background">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-2 md:gap-8">
            <Link href="/dashboard" className="text-lg font-semibold tracking-tight text-primary">
              BergLabs
            </Link>
            <MainNav role={profile.role} />
          </div>
          <UserMenu
            fullName={profile.full_name || profile.email}
            email={profile.email}
            organizationName={organization.name}
          />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
