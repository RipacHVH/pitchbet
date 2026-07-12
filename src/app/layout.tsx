import type { Metadata, Viewport } from "next";
import { Archivo, Nunito, Geist_Mono } from "next/font/google";
import { AppProviders } from "@/components/AppProviders";
import { siteUrl } from "@/lib/site";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  style: ["normal", "italic"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const DESCRIPTION =
  "Free football prediction game on real upcoming matches with real bookmaker odds. " +
  "Call winners, climb the ranked Showdown ladder in 1v1 duels, and run private leagues with your friends. No real money, ever.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "Futcaster — call it before kickoff",
    template: "%s · Futcaster",
  },
  description: DESCRIPTION,
  applicationName: "Futcaster",
  keywords: [
    "football prediction game",
    "soccer prediction game",
    "free football game",
    "predict football matches",
    "football odds game",
    "1v1 football duel",
    "fantasy football alternative",
    "world cup predictions",
    "football picks with friends",
  ],
  category: "games",
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Futcaster",
    title: "Futcaster — call it before kickoff",
    description: DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Futcaster — call it before kickoff",
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  alternates: { canonical: "/" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#140e33",
  width: "device-width",
  initialScale: 1,
};

/** Structured data: tell crawlers this is a free game with online play. */
const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "VideoGame",
  name: "Futcaster",
  description: DESCRIPTION,
  genre: ["Sports", "Prediction", "Casual"],
  playMode: ["SinglePlayer", "MultiPlayer"],
  applicationCategory: "Game",
  gamePlatform: "Web browser",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${nunito.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="relative min-h-full flex flex-col overflow-x-hidden">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
        {/* Ambient stadium: pitch centre-circle on the horizon */}
        <div
          aria-hidden
          className="pointer-events-none fixed -bottom-[60vh] left-1/2 -z-10 h-[80vh] w-[160vw] -translate-x-1/2 rounded-[50%] border-2 border-white/[0.06]"
        />
        <div
          aria-hidden
          className="pointer-events-none fixed -bottom-[60vh] left-1/2 -z-10 h-[110vh] w-[220vw] -translate-x-1/2 rounded-[50%] border-2 border-white/[0.04]"
        />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
