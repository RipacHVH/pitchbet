import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tickets — your open and settled bets",
  description: "Track every call you've made, settle finished matches, and relive the wins.",
  alternates: { canonical: "/bets" },
};

export default function BetsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
