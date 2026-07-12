import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "The Locker Room — spend your coins",
  description:
    "Kits, crowns, halos and more. Everything is bought with coins you win in the game — no real money, ever.",
  alternates: { canonical: "/shop" },
};

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return children;
}
