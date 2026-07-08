import type { Metadata } from "next";
import { LegalDocument } from "@/components/layout/legal-document";
import { SEAT_PRICE_SEK } from "@/lib/subscription";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Användarvillkor",
  description: "Villkor för användning av BergLabs.",
};

export default function TermsPage() {
  return (
    <LegalDocument title="Användarvillkor" lastUpdated="8 juli 2026">
      <section className="space-y-3">
        <h2>1. Tjänsten</h2>
        <p>
          {SITE.name} är en molntjänst för svenska fastighetsmäklare som hjälper till att
          skapa bostadsannonser med AI utifrån objektsfakta och bilder. Tjänsten tillhandahålls
          som den är; vi utvecklar och förbättrar funktionerna löpande.
        </p>
      </section>

      <section className="space-y-3">
        <h2>2. Konto och ansvar</h2>
        <p>
          Varje mäklarbyrå registrerar ett organisationskonto. Ägaren ansvarar för att
          endast behöriga personer bjuds in och att inloggningsuppgifter hanteras säkert.
          Användare får inte dela konto med obehöriga eller använda tjänsten på sätt som
          bryter mot lag eller tredje parts rättigheter.
        </p>
      </section>

      <section className="space-y-3">
        <h2>3. Priser och fakturering</h2>
        <p>
          Priset är {SEAT_PRICE_SEK} kr per aktiv mäklare och månad, inklusive moms.
          Fakturering sker manuellt utanför appen enligt överenskommelse med er byrå.
          Antal platser (medarbetare och väntande inbjudningar) visas i tjänsten för
          uppföljning.
        </p>
      </section>

      <section className="space-y-3">
        <h2>4. Innehåll och AI-genererad text</h2>
        <p>
          Mäklaren ansvarar alltid för att granska och godkänna annonstext och bilder innan
          publicering. AI-genererat innehåll är ett utkast – {SITE.name} garanterar inte att
          texten uppfyller alla krav från mäklarsystem, Hemnet eller Fastighetsmäklarinspektionen.
        </p>
      </section>

      <section className="space-y-3">
        <h2>5. Immateriella rättigheter</h2>
        <p>
          Er byrå behåller rättigheterna till det innehåll ni laddar upp och genererar.
          {SITE.name} får behandla innehållet enbart för att tillhandahålla tjänsten enligt
          vår{" "}
          <a href="/integritetspolicy" className="underline underline-offset-4">
            integritetspolicy
          </a>
          .
        </p>
      </section>

      <section className="space-y-3">
        <h2>6. Tillgänglighet och ansvarsbegränsning</h2>
        <p>
          Vi strävar efter hög tillgänglighet men kan inte garantera att tjänsten alltid är
          felfri eller oavbruten. {SITE.name} ansvarar inte för indirekta skador, utebliven
          försäljning eller förlust till följd av driftstörningar, AI-fel eller felaktigt
          innehåll som inte granskats av användaren.
        </p>
      </section>

      <section className="space-y-3">
        <h2>7. Uppsägning och radering</h2>
        <p>
          Er byrå kan när som helst avsluta tjänsten. Vid uppsägning kan ägaren radera all
          byrådata permanent i appen. Vi kan suspendera eller avsluta konton som missbrukar
          tjänsten eller inte betalar enligt fakturaavtal.
        </p>
      </section>

      <section className="space-y-3">
        <h2>8. Tillämplig lag och kontakt</h2>
        <p>
          Svensk lag tillämpas. Tvister ska i första hand lösas i samförstånd. Kontakta{" "}
          <a href={`mailto:${SITE.supportEmail}`} className="underline underline-offset-4">
            {SITE.supportEmail}
          </a>{" "}
          vid frågor om villkoren.
        </p>
      </section>
    </LegalDocument>
  );
}
