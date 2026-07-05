"use client";

import { useEffect, useState } from "react";

function format(ms: number): string {
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "under a minute";
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function Countdown({ iso, prefix = "kicks off in" }: { iso: string; prefix?: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const ms = Date.parse(iso) - now;
  if (ms <= 0) return <span>kick-off!</span>;
  return (
    <span>
      {prefix} <span className="font-bold text-gold-300">{format(ms)}</span>
    </span>
  );
}
