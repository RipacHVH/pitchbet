"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Coin({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className="inline-block shrink-0">
      <circle cx="12" cy="12" r="11" fill="#d99a14" />
      <circle cx="12" cy="11" r="10" fill="url(#coinGrad)" />
      <defs>
        <radialGradient id="coinGrad" cx="0.35" cy="0.3" r="1">
          <stop offset="0" stopColor="#ffe9a3" />
          <stop offset="0.55" stopColor="#ffc93c" />
          <stop offset="1" stopColor="#e8a81c" />
        </radialGradient>
      </defs>
      <path
        d="M12 5.5l1.7 3.6 3.8.5-2.8 2.7.7 3.9L12 14.3l-3.4 1.9.7-3.9-2.8-2.7 3.8-.5z"
        fill="#8a5f06"
      />
    </svg>
  );
}

export function Hud({
  balance,
  openBets,
  pulse = false,
}: {
  balance: number | null;
  openBets: number;
  pulse?: boolean;
}) {
  const pathname = usePathname();

  const tab = (href: string, label: string) => (
    <Link
      href={href}
      className={`btn-press whitespace-nowrap rounded-xl px-3 py-1.5 text-sm font-extrabold ${
        pathname === href
          ? "border-b-gold-600 bg-gold-400 text-night-950"
          : "border-b-night-950 bg-night-600 text-lilac-200 hover:bg-night-500"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-night-900/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-4 py-3">
        <div className="flex items-center gap-2">
          <Link href="/" className="display mr-1 text-xl text-white drop-shadow-[0_2px_0_rgba(0,0,0,.6)]">
            Pitch<span className="text-gold-400">Bet</span>
          </Link>
          {tab("/", "Play")}
          {tab("/arena", "Arena")}
          {tab("/shop", "Shop")}
          {tab("/bets", `Tickets${openBets > 0 ? ` · ${openBets}` : ""}`)}
        </div>
        <span
          className={`flex items-center gap-1.5 rounded-full border border-gold-600/60 bg-night-800 py-1.5 pl-2 pr-3 font-mono text-sm font-bold text-gold-300 shadow-[inset_0_2px_6px_rgba(0,0,0,.5)] ${
            pulse ? "coin-pulse" : ""
          }`}
        >
          <Coin />
          {balance === null ? "…" : Math.round(balance).toLocaleString()}
        </span>
      </div>
    </header>
  );
}
