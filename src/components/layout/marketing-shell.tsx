import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SITE } from "@/lib/site";

interface MarketingShellProps {
  children: React.ReactNode;
  /** Hide auth buttons in header (e.g. on login pages that have their own layout). */
  showAuthNav?: boolean;
}

export function MarketingShell({ children, showAuthNav = true }: MarketingShellProps) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
          <Link href="/" className="text-lg font-semibold tracking-tight text-primary">
            {SITE.name}
          </Link>
          {showAuthNav ? (
            <nav className="flex items-center gap-2">
              <Button asChild variant="ghost">
                <Link href="/login">Logga in</Link>
              </Button>
              <Button asChild>
                <Link href="/registrera">Kom igång</Link>
              </Button>
            </nav>
          ) : null}
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-sm text-muted-foreground">
          <span>
            © {new Date().getFullYear()} {SITE.name}
          </span>
          <nav className="flex flex-wrap gap-4">
            <Link href="/integritetspolicy" className="hover:text-foreground">
              Integritetspolicy
            </Link>
            <Link href="/villkor" className="hover:text-foreground">
              Villkor
            </Link>
            <a href={`mailto:${SITE.supportEmail}`} className="hover:text-foreground">
              Kontakt
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
