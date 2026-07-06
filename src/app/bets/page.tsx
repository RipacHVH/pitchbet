"use client";

import { useCallback, useEffect, useState } from "react";
import { Coin, Hud } from "@/components/Hud";
import { TeamBadge } from "@/components/TeamBadge";
import { JoinGate } from "@/components/JoinGate";
import { ResultReveal, type RevealItem } from "@/components/ResultReveal";
import { useMe } from "@/lib/MeContext";
import type { Bet, SettleSummary } from "@/lib/types";

const STAMP: Record<Bet["status"], { label: string; cls: string }> = {
  open: { label: "In play", cls: "text-lilac-300" },
  won: { label: "Won", cls: "text-turf-300" },
  lost: { label: "Lost", cls: "text-danger-300" },
  void: { label: "Refunded", cls: "text-gold-300" },
};

export default function TicketsPage() {
  const { me, loaded: meLoaded, refresh: refreshMe } = useMe();
  const [bets, setBets] = useState<Bet[] | null>(null);
  const [settling, setSettling] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [reveal, setReveal] = useState<RevealItem[] | null>(null);

  const loadBets = useCallback(async () => {
    const res = await fetch("/api/bets");
    if (res.ok) setBets((await res.json()).bets);
    else if (res.status === 401) setBets([]);
  }, []);

  useEffect(() => {
    loadBets();
  }, [loadBets]);

  const handleJoined = async () => {
    await Promise.all([refreshMe(), loadBets()]);
  };

  const settle = async () => {
    setSettling(true);
    setNotice(null);
    const res = await fetch("/api/bets/settle", { method: "POST" });
    setSettling(false);
    if (!res.ok) {
      setNotice("Couldn't check results — try again in a moment.");
      return;
    }
    const s: SettleSummary = await res.json();
    if (s.careerReveal.length > 0) {
      setReveal(
        s.careerReveal.map((r) => ({
          homeTeam: r.homeTeam,
          awayTeam: r.awayTeam,
          homeScore: r.homeScore,
          awayScore: r.awayScore,
          selection: r.selection,
          odds: r.odds,
          won: r.won,
          amount: r.won ? r.payout : -r.stake,
          unit: "coins",
        })),
      );
    } else {
      setNotice(
        s.settled === 0 && s.voided === 0
          ? "No final whistles yet — come back after full time."
          : `${s.settled} ticket${s.settled === 1 ? "" : "s"} settled${s.voided ? `, ${s.voided} refunded` : ""}.`,
      );
    }
    await Promise.all([loadBets(), refreshMe()]);
  };

  const record = (bets ?? []).reduce(
    (acc, b) => {
      if (b.status === "won") acc.w++;
      if (b.status === "lost") acc.l++;
      return acc;
    },
    { w: 0, l: 0 },
  );
  const hasOpen = (bets ?? []).some((b) => b.status === "open");

  return (
    <div className="min-h-dvh pb-16">
      <Hud />

      <main className="mx-auto max-w-2xl px-4">
        <div className="flex items-end justify-between pb-4 pt-8">
          <div>
            <h1 className="display text-4xl text-white drop-shadow-[0_3px_0_rgba(0,0,0,.5)]">
              Tickets
            </h1>
            {(record.w > 0 || record.l > 0) && (
              <p className="mt-1 text-sm font-bold text-lilac-300">
                Record: <span className="text-turf-300">{record.w}W</span> ·{" "}
                <span className="text-danger-300">{record.l}L</span>
              </p>
            )}
          </div>
          {hasOpen && (
            <button
              onClick={settle}
              disabled={settling}
              className="btn-press rounded-2xl border-b-gold-800 bg-gold-400 px-4 py-2 font-black text-night-950 hover:bg-gold-300 disabled:opacity-40"
            >
              {settling ? "Checking…" : "Check results"}
            </button>
          )}
        </div>

        {notice && (
          <div className="pop-in mb-4 rounded-2xl border-2 border-white/15 bg-night-700 px-4 py-3 text-sm font-bold text-lilac-200">
            {notice}
          </div>
        )}

        {meLoaded && !me?.joined ? (
          <JoinGate onJoined={handleJoined} />
        ) : !bets ? (
          <p className="py-16 text-center font-bold text-lilac-400">Opening the vault…</p>
        ) : bets.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-4xl">🎟️</p>
            <p className="mt-2 font-bold text-lilac-300">No tickets yet.</p>
            <p className="text-sm font-semibold text-lilac-400">
              Head to Play and call your first match.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {bets.map((b) => {
              const stamp = STAMP[b.status];
              const pickName =
                b.selection === "home" ? b.home_team : b.selection === "away" ? b.away_team : "Draw";
              return (
                <li
                  key={b.id}
                  className={`relative grid grid-cols-[1fr_auto] overflow-hidden rounded-2xl border-2 border-white/10 bg-night-700/90 shadow-[0_6px_0_rgba(0,0,0,.3)] ${
                    b.status === "lost" ? "opacity-75" : ""
                  }`}
                >
                  {/* Main side */}
                  <div className="p-4">
                    <div className="mb-1.5 flex items-center gap-2">
                      <TeamBadge name={b.home_team} size={30} />
                      <TeamBadge name={b.away_team} size={30} />
                      <p className="display ml-1 text-sm leading-tight text-white">
                        {b.home_team} v {b.away_team}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-lilac-200">
                      {pickName} <span className="font-mono text-gold-300">@{b.odds.toFixed(2)}</span>
                    </p>
                    <p className="mt-1 text-xs font-semibold text-lilac-400">
                      {b.sport_title} ·{" "}
                      {new Date(b.commence_time).toLocaleString(undefined, {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {b.completed === 1 && b.home_score !== null && (
                        <span className="font-mono font-bold text-lilac-200">
                          {" "}
                          · FT {b.home_score}–{b.away_score}
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Ticket stub */}
                  <div className="perforation flex w-28 flex-col items-center justify-center gap-1 p-3 text-center">
                    <span className={`stamp text-xs ${stamp.cls}`}>{stamp.label}</span>
                    <span className="mt-1 flex items-center gap-1 font-mono text-sm font-bold text-white">
                      <Coin size={13} /> {Math.round(b.stake)}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wide text-lilac-400">
                      {b.status === "won" && b.payout !== null
                        ? `paid ${Math.round(b.payout)}`
                        : b.status === "open"
                          ? `to win ${Math.round(b.stake * b.odds)}`
                          : b.status === "void"
                            ? "stake back"
                            : "unlucky"}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      {reveal && <ResultReveal items={reveal} onDone={() => setReveal(null)} />}
    </div>
  );
}
