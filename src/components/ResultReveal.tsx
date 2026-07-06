"use client";

import { useMemo, useState } from "react";
import { TeamBadge } from "./TeamBadge";

export interface RevealItem {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  selection: "home" | "draw" | "away";
  odds: number;
  won: boolean;
  /** Signed swing to show: positive for a win, negative for a loss. */
  amount: number;
  unit: "coins" | "RP";
}

const CONFETTI_COLORS = ["#ffc93c", "#ffe9a3", "#5fe8a0", "#a99fd9", "#ff6b7a", "#ffffff"];

function Confetti({ seed }: { seed: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => {
        const rand = (n: number) => {
          const x = Math.sin(seed * 999 + i * 37 + n * 13) * 10000;
          return x - Math.floor(x);
        };
        return {
          left: rand(1) * 100,
          delay: rand(2) * 0.3,
          duration: 1.6 + rand(3) * 1.2,
          rotate: rand(4) * 360,
          color: CONFETTI_COLORS[Math.floor(rand(5) * CONFETTI_COLORS.length)],
          size: 6 + rand(6) * 6,
        };
      }),
    [seed],
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece absolute top-0"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.4,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
    </div>
  );
}

function pickLabel(item: RevealItem): string {
  return item.selection === "home"
    ? item.homeTeam
    : item.selection === "away"
      ? item.awayTeam
      : "Draw";
}

function AmountCounter({ amount, won }: { amount: number; won: boolean }) {
  const [display, setDisplay] = useState(won ? 0 : amount);

  useMemo(() => {
    if (!won) return;
    const target = amount;
    const durationMs = 900;
    const start = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, won]);

  return <>{display >= 0 ? `+${display}` : display}</>;
}

export function ResultReveal({ items, onDone }: { items: RevealItem[]; onDone: () => void }) {
  const [index, setIndex] = useState(0);
  if (items.length === 0) return null;
  const item = items[index];
  const isLast = index === items.length - 1;
  const netTotal = items.reduce((sum, i) => sum + i.amount, 0);

  const advance = () => {
    if (isLast) onDone();
    else setIndex((i) => i + 1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-night-950/90 p-4 backdrop-blur-sm">
      <div
        key={index}
        className={`pop-in relative w-full max-w-sm overflow-hidden rounded-3xl border-2 p-6 text-center shadow-[0_10px_0_rgba(0,0,0,.4)] ${
          item.won ? "border-gold-600/70 bg-night-700" : "border-white/10 bg-night-800"
        }`}
      >
        {item.won && <Confetti seed={index + 1} />}

        {items.length > 1 && (
          <p className="mb-2 text-[11px] font-extrabold uppercase tracking-widest text-lilac-400">
            Result {index + 1} of {items.length}
          </p>
        )}

        <p className="text-[11px] font-extrabold uppercase tracking-widest text-lilac-400">Full time</p>
        <div className="mt-2 flex items-center justify-center gap-3">
          <div className="flex flex-col items-center gap-1">
            <TeamBadge name={item.homeTeam} size={48} />
            <span className="max-w-20 truncate text-xs font-bold text-white">{item.homeTeam}</span>
          </div>
          <span className="display text-2xl text-white">
            {item.homeScore}–{item.awayScore}
          </span>
          <div className="flex flex-col items-center gap-1">
            <TeamBadge name={item.awayTeam} size={48} />
            <span className="max-w-20 truncate text-xs font-bold text-white">{item.awayTeam}</span>
          </div>
        </div>

        <p className="mt-3 text-sm font-semibold text-lilac-300">
          You called <span className="font-bold text-white">{pickLabel(item)}</span>{" "}
          <span className="font-mono text-gold-300">@{item.odds.toFixed(2)}</span>
        </p>

        <p
          className={`display mt-4 text-4xl ${item.won ? "text-gold-300" : "text-danger-300"}`}
        >
          {item.won ? "WON" : "LOST"}
        </p>
        <p
          className={`mt-1 font-mono text-2xl font-bold ${
            item.won ? "text-turf-300" : "text-danger-300"
          }`}
        >
          <AmountCounter amount={item.amount} won={item.won} /> {item.unit}
        </p>

        <button
          onClick={advance}
          className="btn-press mt-6 w-full rounded-2xl border-b-gold-800 bg-gold-400 py-3 text-lg font-black text-night-950 hover:bg-gold-300"
        >
          {isLast
            ? items.length > 1
              ? `Done · net ${netTotal >= 0 ? "+" : ""}${netTotal} ${item.unit}`
              : "Nice!"
            : "Next"}
        </button>
      </div>
    </div>
  );
}
