import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "BergLabs – AI-genererade bostadsannonser",
    template: "%s | BergLabs",
  },
  description:
    "BergLabs hjälper svenska fastighetsmäklare att skriva professionella bostadsannonser med AI – utifrån bilder och fakta om objektet.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sv" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-[family-name:var(--font-inter)]">
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
