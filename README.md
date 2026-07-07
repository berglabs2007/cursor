# BergLabs

Flerkunds-SaaS för svenska fastighetsmäklare som genererar professionella
bostadsannonser med AI utifrån bilder och fakta om objektet.

## Arkitektur

- **Frontend:** Next.js (App Router, TypeScript, Tailwind CSS, shadcn/ui) – tunn klient utan affärslogik, deployas på Vercel.
- **Backend:** Supabase fullt ut – PostgreSQL, Auth, Storage och **alla** Edge Functions (Deno). AI-anrop, Stripe och Word-export körs aldrig i Next.js.
- **AI:** Anthropic Claude (`claude-sonnet-4-6`) via Edge Functions `generate-listing` och `analyze-images`.
- **Betalning:** Stripe, seat-baserad prenumeration (500 kr/mäklare/mån inkl. moms) via Edge Function `stripe-webhook`.
- **Multi-tenant:** `organization_id` på varje rad + Row Level Security som primär säkerhetsmekanism.

```
src/
  app/                 # Next.js-routes (svenska URL:er)
  components/          # UI-komponenter (auth/, team/, layout/, ui/)
  lib/                 # Supabase-klienter, typer, hjälpfunktioner
supabase/
  migrations/          # SQL-migrationer inkl. RLS-policies
  functions/           # Edge Functions (Deno)
  tests/database/      # pgTAP-tester för RLS
scripts/rls-verify/    # RLS-verifiering utan Docker
```

## Kom igång

### 1. Förutsättningar

- Node.js 20+
- Ett [Supabase-projekt](https://supabase.com/dashboard) – **välj EU-region (t.ex. Frankfurt `eu-central-1`)** för GDPR
- En [Anthropic API-nyckel](https://console.anthropic.com)
- Ett [Stripe-konto](https://dashboard.stripe.com) (behövs först i steg 7)

### 2. Miljövariabler

```bash
cp .env.example .env.local          # Next.js-frontend
cp supabase/.env.example supabase/.env  # Edge Function-secrets
```

Fyll i värdena enligt kommentarerna i respektive fil.

| Fil | Variabel | Var hittar jag värdet? |
| --- | --- | --- |
| `.env.local` | `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Project Settings → API |
| `.env.local` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Samma sida, "anon public" |
| `.env.local` | `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` lokalt, Vercel-domänen i produktion |
| `.env.local` | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe → Developers → API keys |
| `supabase/.env` | `ANTHROPIC_API_KEY` | console.anthropic.com |
| `supabase/.env` | `STRIPE_SECRET_KEY` | Stripe → Developers → API keys |
| `supabase/.env` | `STRIPE_WEBHOOK_SECRET` | Skapas när webhook-endpointen registreras |
| `supabase/.env` | `STRIPE_PRICE_ID` | Stripe → Products (se Stripe-avsnittet) |
| `supabase/.env` | `APP_URL` | Samma som `NEXT_PUBLIC_SITE_URL` |

### 3. Databas

Länka projektet och kör migrationerna:

```bash
npx supabase login
npx supabase link --project-ref <DIN_PROJECT_REF>
npx supabase db push
```

Detta skapar alla tabeller, RLS-policies, triggers och Storage-bucketen
`listing-images`.

### 4. Auth-providers

**E-post/lösenord** är aktiverat som standard i Supabase.

**Google OAuth:**

1. Skapa OAuth-klient i [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   (typ "Web application").
2. Authorized redirect URI: `https://<DIN_PROJECT_REF>.supabase.co/auth/v1/callback`
3. Klistra in Client ID + Secret i Supabase Dashboard → Authentication → Providers → Google.
4. Lägg till din produktionsdomän under Authentication → URL Configuration →
   Redirect URLs: `https://<din-domän>/auth/callback`

### 5. Deploya Edge Functions

```bash
npx supabase secrets set --env-file supabase/.env
npx supabase functions deploy
```

(`stripe-webhook` deployas med `--no-verify-jwt` automatiskt via `supabase/config.toml`.)

### 6. Starta frontend

```bash
npm install
npm run dev
```

Öppna [http://localhost:3000](http://localhost:3000).

## Testa RLS / multi-tenant-isolering

RLS är den primära säkerhetsmekanismen och testas explicit:

**Utan Docker** (kör mot en fristående Postgres):

```bash
# Starta en lokal Postgres på valfritt sätt och kör sedan:
PGHOST=<host> PGPORT=<port> npm run test:rls
```

**Med Docker** (kör pgTAP-sviten i Supabase-miljön):

```bash
npx supabase start
npx supabase test db
```

Testerna verifierar bl.a. att en organisation aldrig kan läsa, ändra eller
radera en annan organisations data, att `created_by` inte kan förfalskas och
att en mäklare inte kan höja sin egen roll.

## Deploy till Vercel

1. Pusha repot till GitHub och importera det i [Vercel](https://vercel.com/new).
2. Sätt miljövariablerna från `.env.example` under Project → Settings →
   Environment Variables.
3. Deploya. Lägg därefter till Vercel-domänen i Supabase →
   Authentication → URL Configuration (Site URL + Redirect URLs).

## Status

- [x] Steg 1: Projektinit (Next.js + Tailwind + shadcn/ui + Supabase CLI)
- [x] Steg 2: Databasmigrationer + RLS-policies + RLS-tester
- [x] Steg 3: Auth-flöde (registrering av byrå, Google OAuth, inbjudan av mäklare)
- [ ] Steg 4: `generate-listing` + annonsformulär
- [ ] Steg 5: `analyze-images` + bilduppladdning
- [ ] Steg 6: `export-listing` (Word) + dashboard
- [ ] Steg 7: Stripe Checkout + `stripe-webhook`
