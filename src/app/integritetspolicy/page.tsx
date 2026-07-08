import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocument } from "@/components/layout/legal-document";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Integritetspolicy",
  description: "Hur BergLabs behandlar personuppgifter och cookies.",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalDocument title="Integritetspolicy" lastUpdated="8 juli 2026">
      <section className="space-y-3">
        <h2>1. Personuppgiftsansvarig</h2>
        <p>
          {SITE.name} är personuppgiftsansvarig för behandlingen av personuppgifter i
          samband med tjänsten. Kontakta oss på{" "}
          <a href={`mailto:${SITE.privacyEmail}`} className="underline underline-offset-4">
            {SITE.privacyEmail}
          </a>{" "}
          vid frågor om integritet eller för att utöva dina rättigheter.
        </p>
      </section>

      <section className="space-y-3">
        <h2>2. Vilka uppgifter vi behandlar</h2>
        <p>Vi behandlar uppgifter som behövs för att leverera tjänsten, bland annat:</p>
        <ul>
          <li>Kontouppgifter: namn, e-postadress och roll (ägare, administratör, mäklare)</li>
          <li>Organisationsuppgifter: byrånamn och organisationsnummer</li>
          <li>Annonser: adress, objektsfakta, genererad text och uppladdade bilder</li>
          <li>Tekniska loggar: t.ex. tidpunkt för inloggning och API-anrop (för säkerhet och felsökning)</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2>3. Ändamål och rättslig grund</h2>
        <p>Vi behandlar personuppgifter för att:</p>
        <ul>
          <li>Tillhandahålla och administrera tjänsten (avtal, GDPR art. 6.1 b)</li>
          <li>Säkerställa säkerhet och förhindra missbruk (berättigat intresse, art. 6.1 f)</li>
          <li>Uppfylla rättsliga skyldigheter, t.ex. bokföringskrav vid fakturering utanför appen (art. 6.1 c)</li>
        </ul>
        <p>
          AI-generering sker via Anthropic Claude. Text och bilder skickas endast för att
          generera annonsinnehåll åt er byrå – aldrig för träning av modeller enligt vår
          leverantörs standardvillkor för API-användning.
        </p>
      </section>

      <section className="space-y-3">
        <h2>4. Lagring och EU-region</h2>
        <p>
          Data lagras inom {SITE.dataRegion} via Supabase (databas, autentisering och
          fillagring). Vi säljer inte personuppgifter och delar dem endast med
          underleverantörer som behövs för att driva tjänsten (Supabase, Anthropic, Vercel
          för frontend-hosting).
        </p>
      </section>

      <section className="space-y-3">
        <h2>5. Cookies</h2>
        <p>
          BergLabs använder <strong>endast nödvändiga cookies</strong> för inloggning,
          sessionshantering och säkerhet (Supabase Auth). Vi använder inte cookies för
          marknadsföring, analys eller spårning över webbplatser.
        </p>
      </section>

      <section className="space-y-3">
        <h2>6. Dina rättigheter</h2>
        <p>Enligt GDPR har du rätt att:</p>
        <ul>
          <li>Begära tillgång till dina personuppgifter</li>
          <li>Begära rättelse av felaktiga uppgifter</li>
          <li>Begära radering (&quot;rätten att bli glömd&quot;) när behandlingen inte längre är nödvändig</li>
          <li>Begära begränsning av behandling eller invända mot viss behandling</li>
          <li>Få ut data i ett strukturerat format (dataportabilitet)</li>
          <li>Lämna klagomål till Integritetsskyddsmyndigheten (IMY)</li>
        </ul>
        <p>
          Kontakta{" "}
          <a href={`mailto:${SITE.privacyEmail}`} className="underline underline-offset-4">
            {SITE.privacyEmail}
          </a>{" "}
          för att utöva dina rättigheter.
        </p>
      </section>

      <section className="space-y-3">
        <h2>7. Radering vid uppsägning</h2>
        <p>
          När er byrå avslutar tjänsten kan ägaren radera all byrådata permanent under{" "}
          <Link href="/installningar" className="underline underline-offset-4">
            Inställningar
          </Link>
          . Detta tar bort annonser, uppladdade bilder, inbjudningar och alla
          medarbetarkonton kopplade till byrån. Fakturaunderlag som krävs enligt bokföringslag
          kan sparas separat utanför appen.
        </p>
      </section>

      <section className="space-y-3">
        <h2>8. Lagringstid</h2>
        <p>
          Uppgifter sparas så länge ert konto är aktivt. Efter radering tas data bort från
          våra aktiva system inom rimlig tid, med undantag för det som måste sparas enligt lag.
        </p>
      </section>
    </LegalDocument>
  );
}
