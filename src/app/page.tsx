"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Coin, Hud } from "@/components/Hud";
import { TeamBadge } from "@/components/TeamBadge";
import { Countdown } from "@/components/Countdown";
import { JoinGate } from "@/components/JoinGate";
import { SpinWheel } from "@/components/SpinWheel";
import Link from "next/link";
import type { Fixture, FixturesResponse, Me, Selection } from "@/lib/types";

interface SlipState {
  fixture: Fixture;
  selection: Selection;
  odds: number;
}

function shortName(team: string): string {
  return team.length <= 12 ? team : team.slice(0, 11) + "…";
}

export default function PlayPage() {
  const [data, setData] = useState<FixturesResponse | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [slip, setSlip] = useState<SlipState | null>(null);
  const [stake, setStake] = useState(50);
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState<{ pick: string; stake: number; win: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pulse, setPulse] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  const loadMe = useCallback(async () => {
    const res = await fetch("/api/me");
    if (res.ok) setMe(await res.json());
  }, []);

  const loadFixtures = useCallback(async (force = false) => {
    const res = await fetch(`/api/fixtures${force ? "?refresh=1" : ""}`);
    if (res.ok) setData(await res.json());
  }, []);

  useEffect(() => {
    loadMe();
    loadFixtures();
  }, [loadMe, loadFixtures]);

  const maxStake = useMemo(() => Math.max(10, Math.floor(me?.balance ?? 10)), [me]);

  const nextKickoff = useMemo(() => {
    const all = data?.leagues.flatMap((l) => l.fixtures) ?? [];
    return all.length > 0 ? all.reduce((a, b) => (a.commence_time < b.commence_time ? a : b)) : null;
  }, [data]);

  const pick = (fixture: Fixture, selection: Selection) => {
    const odds = { home: fixture.home_odds, draw: fixture.draw_odds, away: fixture.away_odds }[selection];
    if (!odds) return;
    setSlip({ fixture, selection, odds });
    setStake((s) => Math.min(s, maxStake));
    setPlaced(null);
    setError(null);
  };

  const placeBet = async () => {
    if (!slip) return;
    setPlacing(true);
    setError(null);
    const res = await fetch("/api/bets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fixtureId: slip.fixture.id, selection: slip.selection, stake }),
    });
    const body = await res.json();
    setPlacing(false);
    if (res.status === 401) {
      setShowJoin(true);
      return;
    }
    if (!res.ok) {
      setError(body.message ?? "That bet didn't go through. Try again.");
      return;
    }
    const pickName =
      slip.selection === "home"
        ? slip.fixture.home_team
        : slip.selection === "away"
          ? slip.fixture.away_team
          : "the draw";
    setMe((m) =>
      m ? { ...m, balance: body.newBalance, openBets: (m.openBets ?? 0) + 1 } : m,
    );
    setSlip(null);
    setPlaced({ pick: pickName, stake, win: body.potentialPayout });
    setPulse(true);
    setTimeout(() => setPulse(false), 1200);
  };

  const handleJoined = async () => {
    setShowJoin(false);
    await loadMe();
  };

  const [showWheel, setShowWheel] = useState(false);

  const onSpinDone = (_prize: number, newBalance: number) => {
    setMe((m) => (m ? { ...m, balance: newBalance, spinAvailable: false } : m));
    setPulse(true);
    setTimeout(() => setPulse(false), 1200);
  };

  return (
    <div className="min-h-dvh pb-64">
      <Hud balance={me?.balance ?? null} openBets={me?.openBets ?? 0} pulse={pulse} />

      <main className="mx-auto max-w-2xl px-4">
        {/* Hero */}
        <section className="pb-5 pt-8 text-center">
          <h1 className="display text-5xl leading-none text-white drop-shadow-[0_4px_0_rgba(0,0,0,.5)] sm:text-6xl">
            Match<span className="text-gold-400">day</span>
          </h1>
          <p className="mt-2 font-semibold text-lilac-300">
            Freeplay. Call winners, stack coins, spend them in the Vault below.
          </p>
          {me?.joined && me.spinAvailable && (
            <button
              onClick={() => setShowWheel(true)}
              className="btn-press pop-in mx-auto mt-3 flex items-center gap-2 rounded-full border-b-gold-800 bg-gold-400 px-4 py-2 font-black text-night-950 hover:bg-gold-300"
            >
              🎡 Daily spin ready — up to 1,000 <Coin size={14} />
            </button>
          )}
          {nextKickoff && (
            <p className="mx-auto mt-3 w-fit rounded-full border border-white/10 bg-night-800/80 px-4 py-1.5 text-sm font-bold text-lilac-200">
              ⏱ Next match <Countdown iso={nextKickoff.commence_time} prefix="in" /> —{" "}
              {shortName(nextKickoff.home_team)} v {shortName(nextKickoff.away_team)}
            </p>
          )}
        </section>

        {placed && (
          <div className="pop-in mb-5 flex items-center gap-3 rounded-2xl border-2 border-gold-600/70 bg-night-700 p-4 shadow-[0_6px_0_rgba(0,0,0,.35)]">
            <span className="text-3xl">🎟️</span>
            <div>
              <p className="display text-sm text-gold-300">Ticket locked in</p>
              <p className="text-sm font-semibold text-lilac-200">
                {placed.stake} coins on {placed.pick}. Cash out{" "}
                <span className="font-mono font-bold text-white">{Math.round(placed.win)}</span> if you
                called it.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="pop-in mb-5 rounded-2xl border-2 border-danger-400/60 bg-danger-900 px-4 py-3 text-sm font-bold text-danger-300">
            {error}
          </div>
        )}

        {!data ? (
          <p className="py-16 text-center font-bold text-lilac-400">Setting up the pitch…</p>
        ) : data.leagues.length === 0 ? (
          <p className="py-16 text-center font-bold text-lilac-400">
            No matches on the board right now — check back soon.
          </p>
        ) : (
          data.leagues.map((league) => (
            <section key={league.sportKey} className="mb-8">
              <h2 className="display mb-3 flex items-center gap-2 text-lg text-white">
                {league.sportKey === "soccer_fifa_world_cup" && <span className="not-italic">🏆</span>}
                {league.sportTitle}
              </h2>
              <div className="flex flex-col gap-4">
                {league.fixtures.map((f) => (
                  <MatchCard
                    key={f.id}
                    fixture={f}
                    active={slip?.fixture.id === f.id ? slip.selection : null}
                    onPick={pick}
                  />
                ))}
              </div>
            </section>
          ))
        )}

        {me?.joined && (
          <Link
            href="/shop"
            className="btn-press mt-8 flex items-center justify-between rounded-3xl border-2 border-white/10 border-b-night-950 bg-night-700 p-4 hover:bg-night-600"
          >
            <div>
              <p className="display text-lg text-white">The Locker Room</p>
              <p className="text-xs font-bold text-lilac-300">
                Spend your coins: kits, crowns, halos — even a free month of Pro.
              </p>
            </div>
            <span className="text-3xl">🛍️</span>
          </Link>
        )}

        {data && (
          <p className="mt-4 pb-6 text-center text-xs font-semibold text-lilac-400/70">
            Odds are live prices from real bookmakers ·{" "}
            <button onClick={() => loadFixtures(true)} className="underline hover:text-lilac-200">
              refresh
            </button>
          </p>
        )}
      </main>

      {slip && (
        <BetSlip
          slip={slip}
          stake={stake}
          maxStake={maxStake}
          placing={placing}
          onStake={setStake}
          onClose={() => setSlip(null)}
          onPlace={placeBet}
        />
      )}

      {showJoin && <JoinGate modal onJoined={handleJoined} onClose={() => setShowJoin(false)} />}
      {showWheel && <SpinWheel onDone={onSpinDone} onClose={() => setShowWheel(false)} />}
    </div>
  );
}

function MatchCard({
  fixture,
  active,
  onPick,
}: {
  fixture: Fixture;
  active: Selection | null;
  onPick: (f: Fixture, s: Selection) => void;
}) {
  const options: { sel: Selection; label: string; odds: number | null }[] = [
    { sel: "home", label: shortName(fixture.home_team), odds: fixture.home_odds },
    { sel: "draw", label: "Draw", odds: fixture.draw_odds },
    { sel: "away", label: shortName(fixture.away_team), odds: fixture.away_odds },
  ];

  return (
    <div className="rounded-3xl border-2 border-white/10 bg-night-700/90 p-4 shadow-[0_8px_0_rgba(0,0,0,.35)]">
      {/* VS row */}
      <div className="mb-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="flex flex-col items-center gap-1.5 text-center">
          <TeamBadge name={fixture.home_team} />
          <span className="display text-sm leading-tight text-white">{fixture.home_team}</span>
        </div>
        <span className="display px-1 text-2xl text-lilac-400/60">vs</span>
        <div className="flex flex-col items-center gap-1.5 text-center">
          <TeamBadge name={fixture.away_team} />
          <span className="display text-sm leading-tight text-white">{fixture.away_team}</span>
        </div>
      </div>

      <p className="mb-3 text-center text-xs font-bold text-lilac-300">
        <Countdown iso={fixture.commence_time} />
        {" · "}
        {new Date(fixture.commence_time).toLocaleString(undefined, {
          weekday: "short",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>

      <div className="grid grid-cols-3 gap-2">
        {options.map(({ sel, label, odds }) => (
          <button
            key={sel}
            disabled={!odds}
            onClick={() => onPick(fixture, sel)}
            className={`btn-press flex flex-col items-center rounded-2xl px-1 py-2.5 ${
              active === sel
                ? "border-b-gold-600 bg-gold-400 text-night-950"
                : "border-b-night-950 bg-night-600 text-white hover:bg-night-500 disabled:opacity-30"
            }`}
          >
            <span
              className={`max-w-full truncate text-[11px] font-extrabold uppercase tracking-wide ${
                active === sel ? "text-night-800" : "text-lilac-300"
              }`}
            >
              {label}
            </span>
            <span className="font-mono text-lg font-bold">{odds ? odds.toFixed(2) : "–"}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function BetSlip({
  slip,
  stake,
  maxStake,
  placing,
  onStake,
  onClose,
  onPlace,
}: {
  slip: SlipState;
  stake: number;
  maxStake: number;
  placing: boolean;
  onStake: (n: number) => void;
  onClose: () => void;
  onPlace: () => void;
}) {
  const potential = stake * slip.odds;
  const clamped = Math.min(stake, maxStake);
  const pct = maxStake <= 10 ? 100 : ((clamped - 10) / (maxStake - 10)) * 100;
  const pickName =
    slip.selection === "home"
      ? slip.fixture.home_team
      : slip.selection === "away"
        ? slip.fixture.away_team
        : "Draw";

  return (
    <div className="fixed inset-x-0 bottom-0 z-30">
      <div className="rise-up mx-auto max-w-2xl rounded-t-3xl border-2 border-b-0 border-white/15 bg-night-800 px-4 pb-5 pt-4 shadow-[0_-12px_40px_rgba(0,0,0,.6)]">
        <div className="mb-3 flex items-start justify-between">
          <div className="flex items-center gap-3">
            {slip.selection !== "draw" && <TeamBadge name={pickName} size={44} />}
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-widest text-lilac-400">
                Your call
              </p>
              <p className="display text-lg leading-tight text-white">
                {pickName} <span className="font-mono text-base not-italic text-gold-300">@{slip.odds.toFixed(2)}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close bet slip"
            className="btn-press rounded-xl border-b-night-950 bg-night-600 px-3 py-1.5 font-extrabold text-lilac-200"
          >
            ✕
          </button>
        </div>

        <div className="mb-1 flex items-center justify-between text-sm font-bold">
          <span className="text-lilac-300">Wager</span>
          <span className="flex items-center gap-1 font-mono text-white">
            <Coin size={15} /> {stake}
          </span>
        </div>
        <input
          type="range"
          min={10}
          max={maxStake}
          step={10}
          value={clamped}
          onChange={(e) => onStake(Number(e.target.value))}
          aria-label="Wager amount"
          className="stake w-full"
          style={{
            background: `linear-gradient(to right, #ffc93c ${pct}%, #322473 ${pct}%)`,
            boxShadow: "inset 0 2px 4px rgba(0,0,0,.5)",
          }}
        />
        <div className="mt-2 flex gap-2">
          {([0.1, 0.25, 0.5, 1] as const).map((f) => (
            <button
              key={f}
              onClick={() => onStake(Math.max(10, Math.floor((maxStake * f) / 10) * 10))}
              className="btn-press rounded-lg border-b-night-950 bg-night-600 px-2.5 py-1 text-xs font-extrabold text-lilac-200 hover:bg-night-500"
            >
              {f === 1 ? "ALL IN" : `${f * 100}%`}
            </button>
          ))}
        </div>

        <button
          onClick={onPlace}
          disabled={placing || stake > maxStake}
          className="btn-press mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-b-gold-800 bg-gold-400 py-3.5 text-lg font-black text-night-950 hover:bg-gold-300 disabled:opacity-40"
        >
          {placing ? (
            "Locking it in…"
          ) : (
            <>
              <span className="display text-base">Lock it in</span>
              <span className="font-mono text-sm font-bold">
                {stake} → {Math.round(potential)}
              </span>
              <Coin size={16} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
