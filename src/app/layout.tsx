import type { Metadata } from "next";
import { Archivo, Nunito, Geist_Mono } from "next/font/google";
import { AppProviders } from "@/components/AppProviders";
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

export const metadata: Metadata = {
  title: "Futcaster — call it before kickoff",
  description: "A football forecasting game on real upcoming matches. Pick winners, stack coins.",
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
