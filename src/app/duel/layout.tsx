import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Showdown — ranked 1v1 football duels",
  description:
    "The ranked mode: get paired 1v1 on the next big clash, seal a secret call and exact scoreline, winner takes the pot and climbs the ladder.",
  alternates: { canonical: "/duel" },
};

export default function DuelLayout({ children }: { children: React.ReactNode }) {
  return children;
}
