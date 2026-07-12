import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Friends Leagues — out-call your mates",
  description:
    "Create a private league, share the invite code, and compete with friends over a slate of real matches. Bragging rights only.",
  alternates: { canonical: "/arena" },
};

export default function ArenaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
