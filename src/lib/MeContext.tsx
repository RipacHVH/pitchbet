"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Me } from "./types";

export interface MeContextValue {
  me: Me | null;
  /** True once the first /api/me fetch has resolved (success or failure). */
  loaded: boolean;
  /** Re-fetch from the server — call after login/logout/register or any action that changes balance/RP/items. */
  refresh: () => Promise<void>;
  /** Patch the cached value locally for instant feedback, without a round-trip. */
  update: (updater: Me | null | ((prev: Me | null) => Me | null)) => void;
}

const MeContext = createContext<MeContextValue | null>(null);

/**
 * Fetches /api/me exactly once per app load (this provider lives in the root
 * layout, which Next.js keeps mounted across client-side navigations) and
 * shares it everywhere. Without this, every page fetched its own copy on
 * mount, so the header flashed "logged out" on every tab switch until that
 * page's request resolved.
 */
export function MeProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loaded, setLoaded] = useState(false);
  const inFlight = useRef<Promise<void> | null>(null);

  const refresh = useCallback(async () => {
    if (inFlight.current) return inFlight.current;
    const p = (async () => {
      try {
        const res = await fetch("/api/me");
        if (res.ok) setMe(await res.json());
      } finally {
        setLoaded(true);
      }
    })();
    inFlight.current = p;
    try {
      await p;
    } finally {
      inFlight.current = null;
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const update = useCallback(
    (updater: Me | null | ((prev: Me | null) => Me | null)) => {
      setMe((prev) => (typeof updater === "function" ? (updater as (p: Me | null) => Me | null)(prev) : updater));
    },
    [],
  );

  return <MeContext.Provider value={{ me, loaded, refresh, update }}>{children}</MeContext.Provider>;
}

export function useMe(): MeContextValue {
  const ctx = useContext(MeContext);
  if (!ctx) throw new Error("useMe must be used within <MeProvider>");
  return ctx;
}
