import Link from "next/link";
import { MarketingShell } from "@/components/layout/marketing-shell";

interface LegalDocumentProps {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}

export function LegalDocument({ title, lastUpdated, children }: LegalDocumentProps) {
  return (
    <MarketingShell>
      <article className="mx-auto w-full max-w-3xl px-4 py-12 sm:py-16">
        <p className="text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground">
            ← Tillbaka till startsidan
          </Link>
        </p>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Senast uppdaterad: {lastUpdated}</p>
        <div className="mt-10 space-y-8 text-sm leading-relaxed text-foreground [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_p]:text-muted-foreground [&_strong]:font-medium [&_strong]:text-foreground [&_ul]:space-y-2">
          {children}
        </div>
      </article>
    </MarketingShell>
  );
}
