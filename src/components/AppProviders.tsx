"use client";

import { MeProvider } from "@/lib/MeContext";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <MeProvider>{children}</MeProvider>;
}
