"use client";

import { useCallback, useEffect, useState } from "react";
import { Hud } from "@/components/Hud";
import { TeamBadge } from "@/components/TeamBadge";
import { Countdown } from "@/components/Countdown";
import { JoinGate } from "@/components/JoinGate";
import { RankBadge } from "@/components/RankBadge";
import { ManagerAvatar } from "@/components/ManagerAvatar";
import { parseAvatar } from "@/lib/avatar";
import { useMe } from "@/lib/MeContext";
import type {
  ArenaBet,
  ArenaInfo,
  ArenaResponse,
  ArenaStanding,
  Fixture,
  LeaderboardResponse,
  Selection,
} from "@/lib/types";

function rpForOdds(odds: number): number {
  return Math.max(1, Math.round(odds * 10));
}

function pointsLabel(points: number): string {
  return points > 0 ? `+${points}` : `${points}`;
}

export default function ArenaPage() {
  const { me, loaded: meLoaded, refresh: refreshMe } = useMe();
  const [data, setData] = useState<ArenaResponse | null>(null);
  const [board, setBoard] = useState<LeaderboardResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    const [arenaRes, boardRes] = await Promise.all([
      fetch("/api/arena"),
      fetch("/api/leaderboard"),
    ]);
    if (arenaRes.ok) setData(await arenaRes.json());
    if (boardRes.ok) setBoard(await boardRes.json());
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  const handleJoined = async () => {
    await Promise.all([refreshMe(), load()]);
  };

  const enterArena = async (arenaId: number) => {
    setBusy(true);
    const res = await fetch("/api/arena/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ arenaId }),
    });
    setBusy(false);
    if (!res.ok) {
      setNotice({ kind: "err", text: (await res.json()).message ?? "Couldn't enter." });
      return;
    }
    setNotice({
      kind: "ok",
      text: "You're in. Call each match — the odds are the rank points you're playing for.",
    });
    await load();
  };

  const checkResults = async () => {
    setBusy(true);
    setNotice(null);
    const res = await fetch("/api/arena/settle", { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      setNotice({ kind: "err", text: "Couldn't check results — try again in a moment." });
      return;
    }
    const s = await res.json();
    setNotice({
      kind: "ok",
      text:
        s.arenasFinalized > 0
          ? "🏁 Full time! The table is final — rank points are in the books."
          : "The table updates as matches finish. No new final whistles yet.",
    });
    await Promise.all([load(), refreshMe()]);
  };

  const joined = me?.joined === true;
  const current = data?.current ?? null;
  const showSettled = !current && data?.lastSettled ? data.lastSettled : null;

  return (
    <div className="min-h-dvh pb-16">
      <Hud />

      <main className="mx-auto max-w-2xl px-4">
        <section className="pb-5 pt-8 text-center">
          <h1 className="display text-5xl leading-none text-white drop-shadow-[0_4px_0_rgba(0,0,0,.5)]">
            The <span className="text-gold-400">Arena</span>
          </h1>
          <p className="mt-2 font-semibold text-lilac-300">
            No coins here. Call it right, the odds become rank points. Call it wrong, they&apos;re gone.
          </p>
          {joined && me && (
            <div className="mt-3 flex items-center justify-center gap-2">
              <span className="font-bold text-white">{me.username}</span>
              <RankBadge rp={me.rp ?? 0} showRp />
            </div>
          )}
        </section>

        {notice && (
          <div
            className={`pop-in mb-5 rounded-2xl border-2 px-4 py-3 text-sm font-bold ${
              notice.kind === "ok"
                ? "border-gold-600/60 bg-night-700 text-lilac-100"
                : "border-danger-400/60 bg-danger-900 text-danger-300"
            }`}
          >
            {notice.text}
          </div>
        )}

        {!meLoaded || data === null ? (
          <p className="py-16 text-center font-bold text-lilac-400">Opening the gates…</p>
        ) : !joined ? (
          <JoinGate onJoined={handleJoined} />
        ) : current ? (
          <ArenaBoard
            info={current}
            meId={data.me?.id ?? null}
            busy={busy}
            onEnter={() => enterArena(current.arena.id)}
            onPickLocked={load}
            onCheckResults={checkResults}
          />
        ) : showSettled ? (
          <>
            <SettledArena info={showSettled} meId={data.me?.id ?? null} />
            <p className="mt-4 text-center text-sm font-bold text-lilac-300">
              A new arena opens as soon as the next matches get odds.
            </p>
          </>
        ) : (
          <p className="py-16 text-center font-bold text-lilac-400">
            No arena right now — needs at least two upcoming matches with odds.
          </p>
        )}

        {board && board.players.length > 0 && <WorldRankings board={board} />}
      </main>
    </div>
  );
}

/* ---------------- Open arena: slate + live table ---------------- */

function ArenaBoard({
  info,
  meId,
  busy,
  onEnter,
  onPickLocked,
  onCheckResults,
}: {
  info: ArenaInfo;
  meId: number | null;
  busy: boolean;
  onEnter: () => void;
  onPickLocked: () => void;
  onCheckResults: () => void;
}) {
  const entered = info.entry !== null;
  const anyKickedOff = info.fixtures.some((f) => Date.parse(f.commence_time) <= Date.now());

  return (
    <>
      {/* Arena status card */}
      <div className="mb-5 flex items-center justify-between rounded-3xl border-2 border-gold-600/40 bg-night-700 p-4 shadow-[0_8px_0_rgba(0,0,0,.35)]">
        <div>
          <p className="display text-lg text-white">{info.arena.name}</p>
          <p className="text-xs font-bold text-lilac-300">
            {info.fixtures.length} matches · {info.standings.length} player
            {info.standings.length === 1 ? "" : "s"} in
          </p>
        </div>
        {entered ? (
          <div className="text-right">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-lilac-400">
              This matchday
            </p>
            <p
              className={`font-mono text-xl font-bold ${
                info.entry!.points >= 0 ? "text-gold-300" : "text-danger-300"
              }`}
            >
              {pointsLabel(info.entry!.points)} RP
            </p>
          </div>
        ) : (
          <button
            onClick={onEnter}
            disabled={busy}
            className="btn-press rounded-2xl border-b-gold-800 bg-gold-400 px-4 py-2.5 font-black text-night-950 hover:bg-gold-300 disabled:opacity-40"
          >
            Enter free
          </button>
        )}
      </div>

      {/* Slate */}
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="display text-lg text-white">The slate</h2>
        <p className="text-[11px] font-bold text-lilac-400">
          Longshots pay more — and cost more
        </p>
      </div>
      <div className="mb-6 flex flex-col gap-3">
        {info.fixtures.map((f) => (
          <SlateCard
            key={f.id}
            fixture={f}
            arenaId={info.arena.id}
            entered={entered}
            myBet={info.myBets.find((b) => b.fixture_id === f.id) ?? null}
            onLocked={onPickLocked}
          />
        ))}
      </div>

      {/* Live table */}
      {info.standings.length > 0 && (
        <>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="display text-lg text-white">The table</h2>
            {anyKickedOff && (
              <button
                onClick={onCheckResults}
                disabled={busy}
                className="btn-press rounded-xl border-b-gold-800 bg-gold-400 px-3 py-1.5 text-sm font-black text-night-950 hover:bg-gold-300 disabled:opacity-40"
              >
                {busy ? "Checking…" : "Check results"}
              </button>
            )}
          </div>
          <StandingsTable standings={info.standings} meId={meId} live />
        </>
      )}
    </>
  );
}

function SlateCard({
  fixture,
  arenaId,
  entered,
  myBet,
  onLocked,
}: {
  fixture: Fixture;
  arenaId: number;
  entered: boolean;
  myBet: ArenaBet | null;
  onLocked: () => void;
}) {
  const [sel, setSel] = useState<Selection | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const kickedOff = Date.parse(fixture.commence_time) <= Date.now();
  const finished = fixture.completed === 1 && fixture.home_score !== null;

  const oddsFor = (s: Selection) =>
    ({ home: fixture.home_odds, draw: fixture.draw_odds, away: fixture.away_odds })[s];

  const pickLabel = (s: Selection) =>
    s === "home" ? fixture.home_team : s === "away" ? fixture.away_team : "Draw";

  const lock = async () => {
    if (!sel) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/arena/bet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ arenaId, fixtureId: fixture.id, selection: sel }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json()).message ?? "Couldn't lock that pick.");
      return;
    }
    setSel(null);
    onLocked();
  };

  return (
    <div className="rounded-3xl border-2 border-white/10 bg-night-700/90 p-4 shadow-[0_6px_0_rgba(0,0,0,.3)]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <TeamBadge name={fixture.home_team} size={34} />
          <TeamBadge name={fixture.away_team} size={34} />
          <p className="display ml-1 truncate text-sm text-white">
            {fixture.home_team} v {fixture.away_team}
          </p>
        </div>
        <p className="shrink-0 text-xs font-bold text-lilac-300">
          {finished ? (
            <span className="font-mono text-white">
              FT {fixture.home_score}–{fixture.away_score}
            </span>
          ) : kickedOff ? (
            <span className="text-gold-300">In play</span>
          ) : (
            <Countdown iso={fixture.commence_time} prefix="in" />
          )}
        </p>
      </div>

      {myBet ? (
        <div
          className={`flex items-center justify-between rounded-2xl border-2 px-3 py-2 ${
            myBet.status === "won"
              ? "border-turf-400/60 bg-turf-900"
              : myBet.status === "lost"
                ? "border-danger-400/40 bg-danger-900/60"
                : "border-gold-600/50 bg-night-800"
          }`}
        >
          <p className="text-sm font-bold text-white">
            {pickLabel(myBet.selection)}{" "}
            <span className="font-mono text-gold-300">@{myBet.odds.toFixed(2)}</span>
            <span className="ml-2 font-mono text-xs text-lilac-300">
              ±{rpForOdds(myBet.odds)} RP riding
            </span>
          </p>
          <span
            className={`stamp text-[10px] ${
              myBet.status === "won"
                ? "text-turf-300"
                : myBet.status === "lost"
                  ? "text-danger-300"
                  : myBet.status === "void"
                    ? "text-lilac-300"
                    : "text-gold-300"
            }`}
          >
            {myBet.status === "open"
              ? "Locked"
              : myBet.status === "void"
                ? "Void"
                : `${pointsLabel(myBet.rp_delta ?? 0)} RP`}
          </span>
        </div>
      ) : !entered ? (
        <p className="text-xs font-bold text-lilac-400">Enter the arena to make your call.</p>
      ) : kickedOff ? (
        <p className="text-xs font-bold text-lilac-400">No pick — kicked off without you.</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            {(["home", "draw", "away"] as const).map((s) => {
              const odds = oddsFor(s);
              return (
                <button
                  key={s}
                  disabled={!odds}
                  onClick={() => setSel(sel === s ? null : s)}
                  className={`btn-press flex flex-col items-center rounded-xl px-1 py-2 ${
                    sel === s
                      ? "border-b-gold-600 bg-gold-400 text-night-950"
                      : "border-b-night-950 bg-night-600 text-white hover:bg-night-500 disabled:opacity-30"
                  }`}
                >
                  <span
                    className={`max-w-full truncate text-[10px] font-extrabold uppercase ${
                      sel === s ? "text-night-800" : "text-lilac-300"
                    }`}
                  >
                    {pickLabel(s)}
                  </span>
                  <span className="font-mono text-base font-bold">
                    {odds ? `±${rpForOdds(odds)} RP` : "–"}
                  </span>
                </button>
              );
            })}
          </div>

          {sel && (
            <div className="pop-in mt-3 flex items-center justify-between gap-2 rounded-2xl border-2 border-gold-600/40 bg-night-800 px-3 py-2">
              <p className="text-xs font-bold text-lilac-200">
                {pickLabel(sel)} right{" "}
                <span className="font-mono text-turf-300">+{rpForOdds(oddsFor(sel)!)} RP</span>
                {" · "}wrong{" "}
                <span className="font-mono text-danger-300">−{rpForOdds(oddsFor(sel)!)} RP</span>
              </p>
              <button
                onClick={lock}
                disabled={busy}
                className="btn-press shrink-0 rounded-xl border-b-gold-800 bg-gold-400 px-4 py-1.5 text-sm font-black text-night-950 hover:bg-gold-300 disabled:opacity-40"
              >
                {busy ? "Locking…" : "Lock it"}
              </button>
            </div>
          )}
          {error && <p className="mt-2 text-xs font-bold text-danger-300">{error}</p>}
          <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-lilac-400/70">
            Picks are final once locked
          </p>
        </>
      )}
    </div>
  );
}

/* ---------------- Standings + podium ---------------- */

function StandingsTable({
  standings,
  meId,
  live,
}: {
  standings: ArenaStanding[];
  meId: number | null;
  live: boolean;
}) {
  return (
    <ul className="flex flex-col gap-1.5">
      {standings.map((s, i) => {
        const rank = s.final_rank ?? i + 1;
        const isMe = s.player_id === meId;
        return (
          <li
            key={s.player_id}
            className={`flex items-center gap-3 rounded-2xl border-2 px-3 py-2.5 ${
              isMe ? "border-gold-600/70 bg-night-600" : "border-white/10 bg-night-800/80"
            }`}
          >
            <span className="display w-7 text-center text-lg text-lilac-300">
              {rank === 1 ? "👑" : rank}
            </span>
            <ManagerAvatar config={parseAvatar(s.avatar)} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold text-white">
                {s.username}
                {isMe && <span className="ml-1 text-xs font-extrabold text-gold-300">(you)</span>}
              </p>
              <RankBadge rp={s.rp} />
            </div>
            <div className="text-right">
              <p
                className={`font-mono text-sm font-bold ${
                  s.points >= 0 ? "text-gold-300" : "text-danger-300"
                }`}
              >
                {pointsLabel(s.points)} RP
              </p>
              <p className="text-[10px] font-bold text-lilac-400">
                {live ? `${s.picks} pick${s.picks === 1 ? "" : "s"}` : "final"}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function SettledArena({ info, meId }: { info: ArenaInfo; meId: number | null }) {
  const podium = info.standings.slice(0, 3);
  const order = [podium[1], podium[0], podium[2]].filter(Boolean) as ArenaStanding[];
  const heights: Record<number, string> = { 1: "h-28", 2: "h-20", 3: "h-14" };

  return (
    <>
      <div className="mb-2 text-center">
        <p className="display text-lg text-white">{info.arena.name} — full time</p>
      </div>

      {podium.length > 0 && (
        <div className="mb-6 flex items-end justify-center gap-3">
          {order.map((s) => {
            const rank = s.final_rank ?? 1;
            return (
              <div key={s.player_id} className="pop-in flex w-24 flex-col items-center gap-1">
                {rank === 1 && <span className="text-2xl">👑</span>}
                <p className="w-full truncate text-center text-sm font-bold text-white">
                  {s.username}
                </p>
                <p
                  className={`font-mono text-xs font-bold ${
                    s.points >= 0 ? "text-gold-300" : "text-danger-300"
                  }`}
                >
                  {pointsLabel(s.points)} RP
                </p>
                <div
                  className={`w-full rounded-t-xl border-2 border-b-0 ${heights[rank] ?? "h-14"} ${
                    rank === 1
                      ? "border-gold-600 bg-gradient-to-b from-gold-400/60 to-night-700"
                      : "border-white/15 bg-night-600"
                  } flex items-start justify-center pt-1`}
                >
                  <span className="display text-xl text-white/80">{rank}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <StandingsTable standings={info.standings} meId={meId} live={false} />
    </>
  );
}

/* ---------------- Global ladder ---------------- */

function WorldRankings({ board }: { board: LeaderboardResponse }) {
  return (
    <section className="mt-10">
      <h2 className="display mb-3 text-lg text-white">World rankings</h2>
      <ul className="flex flex-col gap-1.5">
        {board.players.map((p, i) => (
          <li
            key={p.id}
            className={`flex items-center gap-3 rounded-2xl border-2 px-3 py-2 ${
              p.id === board.meId ? "border-gold-600/70 bg-night-600" : "border-white/10 bg-night-800/80"
            }`}
          >
            <span className="display w-7 text-center text-lilac-300">{i + 1}</span>
            <ManagerAvatar config={parseAvatar(p.avatar)} size={32} />
            <p className="min-w-0 flex-1 truncate font-bold text-white">
              {p.username}
              {p.id === board.meId && (
                <span className="ml-1 text-xs font-extrabold text-gold-300">(you)</span>
              )}
              {p.arena_wins > 0 && (
                <span className="ml-2 text-xs font-bold text-lilac-300">🏆 {p.arena_wins}</span>
              )}
            </p>
            <div className="flex items-center gap-2">
              <RankBadge rp={p.rp} />
              <span className="w-14 text-right font-mono text-sm font-bold text-lilac-200">
                {p.rp} RP
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
