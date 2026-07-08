import Link from "next/link";
import { ArrowRight, FileText, Image as ImageIcon, Sparkles } from "lucide-react";
import { MarketingShell } from "@/components/layout/marketing-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SEAT_PRICE_SEK } from "@/lib/subscription";

const FEATURES = [
  {
    icon: Sparkles,
    title: "AI-genererad annonstext",
    description:
      "Rubrik, säljande löptext och objektsfakta på sekunder – i mäklarbranschens ton, inte AI-klyschor.",
  },
  {
    icon: ImageIcon,
    title: "Bildanalys",
    description:
      "Ladda upp objektets bilder så identifierar BergLabs säljpunkter som öppen spis, renoverat kök och ljusinsläpp.",
  },
  {
    icon: FileText,
    title: "Export till Word",
    description:
      "Färdigformaterat dokument, klart att klistra in i Hemnet, Vitec eller ert mäklarsystem.",
  },
];

export default function HomePage() {
  return (
    <MarketingShell>
      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Professionella bostadsannonser på minuter – inte timmar
          </h1>
          <p className="mt-6 text-lg text-muted-foreground text-pretty">
            BergLabs skriver säljande, trovärdiga annonstexter åt svenska fastighetsmäklare –
            utifrån objektets fakta och bilder. Du behåller kontrollen, vi sparar tiden.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/registrera">
                Registrera er byrå
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">Logga in</Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            {SEAT_PRICE_SEK} kr per mäklare och månad, inklusive moms.
          </p>
        </div>
      </section>

      <section className="border-t bg-muted/40">
        <div className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-16 sm:grid-cols-3">
          {FEATURES.map((feature) => (
            <Card key={feature.title} className="shadow-none">
              <CardHeader>
                <feature.icon className="size-6 text-primary" />
                <CardTitle className="text-base">{feature.title}</CardTitle>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>
    </MarketingShell>
  );
}
