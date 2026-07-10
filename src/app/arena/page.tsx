"use client";

import { useCallback, useEffect, useState } from "react";
import { Hud } from "@/components/Hud";
import { TeamBadge } from "@/components/TeamBadge";
import { Countdown } from "@/components/Countdown";
import { JoinGate } from "@/components/JoinGate";
import { RankBadge } from "@/components/RankBadge";
import { ManagerAvatar } from "@/components/ManagerAvatar";
import { ResultReveal, type RevealItem } from "@/components/ResultReveal";
import { parseAvatar } from "@/lib/avatar";
import { useMe } from "@/lib/MeContext";
import type {
  ArenaBet,
  ArenaInfo,
  ArenaResponse,
  ArenaStanding,
  Challenge,
  Fixture,
  MyArenaSummary,
  Selection,
  SettleSummary,
  SingleArenaResponse,
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
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [reveal, setReveal] = useState<RevealItem[] | null>(null);

  // The private league being viewed, if any.
  const [viewingArenaId, setViewingArenaId] = useState<number | null>(null);
  const [viewedArena, setViewedArena] = useState<SingleArenaResponse | null>(null);
  const [freshInviteCode, setFreshInviteCode] = useState<string | null>(null);

  const load = useCallback(async () => {
    const arenaRes = await fetch("/api/arena");
    if (arenaRes.ok) setData(await arenaRes.json());
  }, []);

  const loadViewedArena = useCallback(async (id: number) => {
    const res = await fetch(`/api/arena/${id}`);
    if (res.ok) setViewedArena(await res.json());
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([load(), viewingArenaId !== null ? loadViewedArena(viewingArenaId) : null]);
  }, [load, loadViewedArena, viewingArenaId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (viewingArenaId === null) return;
    loadViewedArena(viewingArenaId);
    const t = setInterval(() => loadViewedArena(viewingArenaId), 30_000);
    return () => clearInterval(t);
  }, [viewingArenaId, loadViewedArena]);

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
    await refreshAll();
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
    const s: SettleSummary = await res.json();
    if (s.arenaReveal.length > 0) {
      setReveal(
        s.arenaReveal.map((r) => ({
          homeTeam: r.homeTeam,
          awayTeam: r.awayTeam,
          homeScore: r.homeScore,
          awayScore: r.awayScore,
          selection: r.selection,
          odds: r.odds,
          won: r.won,
          amount: r.rpDelta,
          unit: "RP",
        })),
      );
    } else {
      setNotice({
        kind: "ok",
        text:
          s.arenasFinalized > 0
            ? "🏁 Full time! The table is final — the league table is in the books."
            : "The table updates as matches finish. No new final whistles yet.",
      });
    }
    await Promise.all([refreshAll(), refreshMe()]);
  };

  const sendChallenge = async (arenaId: number, opponentUsername: string) => {
    const res = await fetch("/api/challenges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ arenaId, opponentUsername }),
    });
    const body = await res.json();
    if (!res.ok) {
      setNotice({ kind: "err", text: body.message ?? "Couldn't send that challenge." });
      return;
    }
    setNotice({ kind: "ok", text: `Challenge sent to ${opponentUsername}.` });
    await refreshAll();
  };

  const respondChallenge = async (challengeId: number, accept: boolean) => {
    const res = await fetch(`/api/challenges/${challengeId}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accept }),
    });
    if (!res.ok) {
      setNotice({ kind: "err", text: (await res.json()).message ?? "Couldn't respond." });
      return;
    }
    await refreshAll();
  };

  const createLeague = async (name: string) => {
    const res = await fetch("/api/arena/private", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const body = await res.json();
    if (!res.ok) {
      setNotice({ kind: "err", text: body.message ?? "Couldn't create the league." });
      return;
    }
    setFreshInviteCode(body.inviteCode);
    setViewingArenaId(body.arenaId);
    await load();
  };

  const joinByCode = async (code: string) => {
    const res = await fetch("/api/arena/join-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const body = await res.json();
    if (!res.ok) {
      setNotice({ kind: "err", text: body.message ?? "Couldn't join that league." });
      return;
    }
    setViewingArenaId(body.arenaId);
    await load();
  };

  const joined = me?.joined === true;

  return (
    <div className="min-h-dvh pb-16">
      <Hud />

      <main className="mx-auto max-w-2xl px-4">
        <section className="pb-5 pt-8 text-center">
          <h1 className="display text-5xl leading-none text-white drop-shadow-[0_4px_0_rgba(0,0,0,.5)]">
            Friends <span className="text-gold-400">Leagues</span>
          </h1>
          <p className="mt-2 font-semibold text-lilac-300">
            Make a league, share the code, and out-call your mates over a slate of real matches.
            Bragging rights only — the ranked ladder lives in the Showdown.
          </p>
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
        ) : (
          <>
            <MyLeagues
              leagues={data.myLeagues}
              viewingArenaId={viewingArenaId}
              freshInviteCode={freshInviteCode}
              onView={(id) => {
                setFreshInviteCode(null);
                setViewingArenaId(id);
              }}
              onBack={() => {
                setFreshInviteCode(null);
                setViewingArenaId(null);
              }}
              onCreate={createLeague}
              onJoinCode={joinByCode}
            />

            {viewingArenaId !== null ? (
              !viewedArena ? (
                <p className="py-16 text-center font-bold text-lilac-400">Loading your league…</p>
              ) : viewedArena.arena.arena.status === "open" ? (
                <ArenaBoard
                  info={viewedArena.arena}
                  meId={me?.joined ? (data.me?.id ?? null) : null}
                  challenges={viewedArena.challenges}
                  busy={busy}
                  onEnter={() => enterArena(viewedArena.arena.arena.id)}
                  onPickLocked={refreshAll}
                  onCheckResults={checkResults}
                  onSendChallenge={(username) => sendChallenge(viewedArena.arena.arena.id, username)}
                  onRespondChallenge={respondChallenge}
                />
              ) : (
                <SettledArena info={viewedArena.arena} meId={data.me?.id ?? null} />
              )
            ) : (
              <div className="rounded-3xl border-2 border-gold-600/40 bg-night-800/80 p-8 text-center">
                <p className="text-5xl">🏟️</p>
                <h2 className="display mt-2 text-2xl text-white">YOUR LEAGUE, YOUR RULES</h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-lilac-300">
                  Every league gets a slate of the next real matches. One pick per game — call it
                  right and the odds become league points, call it wrong and they&apos;re gone.
                  Top of the table takes the crown. Create one and share the invite code, or join
                  a mate&apos;s with theirs.
                </p>
              </div>
            )}
          </>
        )}
      </main>

      {reveal && <ResultReveal items={reveal} onDone={() => setReveal(null)} />}
    </div>
  );
}

/* ---------------- Private leagues (fantasy-style groups) ---------------- */

function MyLeagues({
  leagues,
  viewingArenaId,
  freshInviteCode,
  onView,
  onBack,
  onCreate,
  onJoinCode,
}: {
  leagues: MyArenaSummary[];
  viewingArenaId: number | null;
  freshInviteCode: string | null;
  onView: (id: number) => void;
  onBack: () => void;
  onCreate: (name: string) => Promise<void>;
  onJoinCode: (code: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<"create" | "join" | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const submitCreate = async () => {
    if (name.trim().length < 3) return;
    setBusy(true);
    await onCreate(name.trim());
    setBusy(false);
    setName("");
    setMode(null);
  };

  const submitJoin = async () => {
    if (code.trim().length < 4) return;
    setBusy(true);
    await onJoinCode(code.trim());
    setBusy(false);
    setCode("");
    setMode(null);
  };

  return (
    <div className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="display text-lg text-white">My leagues</h2>
        <div className="flex gap-1.5">
          {viewingArenaId !== null && (
            <button
              onClick={onBack}
              className="btn-press rounded-xl border-b-night-950 bg-night-600 px-3 py-1.5 text-sm font-extrabold text-lilac-200 hover:bg-night-500"
            >
              ← All leagues
            </button>
          )}
          <button
            onClick={() => setMode(mode === "create" ? null : "create")}
            className="btn-press rounded-xl border-b-night-950 bg-night-600 px-3 py-1.5 text-sm font-extrabold text-lilac-200 hover:bg-night-500"
          >
            {mode === "create" ? "Cancel" : "🏟️ Create"}
          </button>
          <button
            onClick={() => setMode(mode === "join" ? null : "join")}
            className="btn-press rounded-xl border-b-gold-800 bg-gold-400 px-3 py-1.5 text-sm font-extrabold text-night-950 hover:bg-gold-300"
          >
            {mode === "join" ? "Cancel" : "Join with code"}
          </button>
        </div>
      </div>

      {freshInviteCode && (
        <div className="pop-in mb-3 rounded-2xl border-2 border-gold-600/70 bg-night-700 p-4 text-center">
          <p className="text-xs font-extrabold uppercase tracking-widest text-lilac-300">
            League created! Share this code
          </p>
          <p className="display mt-1 text-3xl tracking-[0.3em] text-gold-300">{freshInviteCode}</p>
        </div>
      )}

      {mode === "create" && (
        <div className="pop-in mb-3 flex gap-2 rounded-2xl border-2 border-gold-600/40 bg-night-800 p-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitCreate()}
            placeholder="League name, e.g. Sunday Sweats"
            maxLength={40}
            autoFocus
            aria-label="League name"
            className="flex-1 rounded-xl border-2 border-white/15 bg-night-900 px-3 py-2 font-bold text-white placeholder:text-lilac-400/50 focus:border-gold-400 focus:outline-none"
          />
          <button
            onClick={submitCreate}
            disabled={busy || name.trim().length < 3}
            className="btn-press shrink-0 rounded-xl border-b-gold-800 bg-gold-400 px-4 py-2 text-sm font-black text-night-950 hover:bg-gold-300 disabled:opacity-40"
          >
            {busy ? "…" : "Create"}
          </button>
        </div>
      )}

      {mode === "join" && (
        <div className="pop-in mb-3 flex gap-2 rounded-2xl border-2 border-gold-600/40 bg-night-800 p-3">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && submitJoin()}
            placeholder="Invite code"
            maxLength={6}
            autoFocus
            aria-label="Invite code"
            className="flex-1 rounded-xl border-2 border-white/15 bg-night-900 px-3 py-2 text-center font-mono font-bold uppercase tracking-[0.3em] text-white placeholder:text-lilac-400/50 focus:border-gold-400 focus:outline-none"
          />
          <button
            onClick={submitJoin}
            disabled={busy || code.trim().length < 4}
            className="btn-press shrink-0 rounded-xl border-b-gold-800 bg-gold-400 px-4 py-2 text-sm font-black text-night-950 hover:bg-gold-300 disabled:opacity-40"
          >
            {busy ? "…" : "Join"}
          </button>
        </div>
      )}

      {leagues.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {leagues.map((l) => (
            <li
              key={l.id}
              className={`flex items-center gap-3 rounded-2xl border-2 px-3 py-2.5 ${
                viewingArenaId === l.id
                  ? "border-gold-600/70 bg-night-600"
                  : "border-white/10 bg-night-800/80"
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-white">{l.name}</p>
                <p className="text-[10px] font-bold uppercase tracking-wide text-lilac-400">
                  {l.memberCount} member{l.memberCount === 1 ? "" : "s"} · {l.status === "open" ? "in play" : "final"}
                  {l.inviteCode && ` · code ${l.inviteCode}`}
                </p>
              </div>
              <span
                className={`shrink-0 font-mono text-sm font-bold ${
                  l.points >= 0 ? "text-gold-300" : "text-danger-300"
                }`}
              >
                {pointsLabel(l.points)} pts
              </span>
              <button
                onClick={() => onView(l.id)}
                disabled={viewingArenaId === l.id}
                className="btn-press shrink-0 rounded-lg border-b-gold-800 bg-gold-400 px-3 py-1.5 text-xs font-extrabold text-night-950 hover:bg-gold-300 disabled:opacity-50"
              >
                {viewingArenaId === l.id ? "Viewing" : "View"}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        !freshInviteCode &&
        mode === null && (
          <p className="text-xs font-bold text-lilac-400">
            No leagues yet — create one for your friend group or join with a code.
          </p>
        )
      )}
    </div>
  );
}

/* ---------------- Open arena: slate + live table ---------------- */

function ArenaBoard({
  info,
  meId,
  challenges,
  busy,
  onEnter,
  onPickLocked,
  onCheckResults,
  onSendChallenge,
  onRespondChallenge,
}: {
  info: ArenaInfo;
  meId: number | null;
  challenges: Challenge[];
  busy: boolean;
  onEnter: () => void;
  onPickLocked: () => void;
  onCheckResults: () => void;
  onSendChallenge: (username: string) => Promise<void>;
  onRespondChallenge: (challengeId: number, accept: boolean) => Promise<void>;
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
            {info.arena.is_private && info.arena.invite_code && (
              <> · code <span className="font-mono text-gold-300">{info.arena.invite_code}</span></>
            )}
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
              {pointsLabel(info.entry!.points)} pts
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

      {entered && (
        <HeadToHead
          challenges={challenges}
          onSendChallenge={onSendChallenge}
          onRespondChallenge={onRespondChallenge}
        />
      )}

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

/* ---------------- Head-to-head challenges ---------------- */

function HeadToHead({
  challenges,
  onSendChallenge,
  onRespondChallenge,
}: {
  challenges: Challenge[];
  onSendChallenge: (username: string) => Promise<void>;
  onRespondChallenge: (challengeId: number, accept: boolean) => Promise<void>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [opponent, setOpponent] = useState("");
  const [sending, setSending] = useState(false);
  const [respondingId, setRespondingId] = useState<number | null>(null);

  const send = async () => {
    if (opponent.trim().length < 3) return;
    setSending(true);
    await onSendChallenge(opponent.trim());
    setSending(false);
    setOpponent("");
    setShowForm(false);
  };

  const respond = async (id: number, accept: boolean) => {
    setRespondingId(id);
    await onRespondChallenge(id, accept);
    setRespondingId(null);
  };

  return (
    <div className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="display text-lg text-white">Head-to-head</h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="btn-press rounded-xl border-b-night-950 bg-night-600 px-3 py-1.5 text-sm font-extrabold text-lilac-200 hover:bg-night-500"
        >
          {showForm ? "Cancel" : "⚔️ Challenge a friend"}
        </button>
      </div>

      {showForm && (
        <div className="pop-in mb-3 flex gap-2 rounded-2xl border-2 border-gold-600/40 bg-night-800 p-3">
          <input
            value={opponent}
            onChange={(e) => setOpponent(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Their player name"
            maxLength={16}
            autoFocus
            aria-label="Opponent's player name"
            className="flex-1 rounded-xl border-2 border-white/15 bg-night-900 px-3 py-2 font-bold text-white placeholder:text-lilac-400/50 focus:border-gold-400 focus:outline-none"
          />
          <button
            onClick={send}
            disabled={sending || opponent.trim().length < 3}
            className="btn-press shrink-0 rounded-xl border-b-gold-800 bg-gold-400 px-4 py-2 text-sm font-black text-night-950 hover:bg-gold-300 disabled:opacity-40"
          >
            {sending ? "…" : "Send"}
          </button>
        </div>
      )}

      {challenges.length > 0 && (
        <ul className="flex flex-col gap-2">
          {challenges.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-3 rounded-2xl border-2 border-white/10 bg-night-800/80 px-3 py-2.5"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <ManagerAvatar config={parseAvatar(c.me.avatar)} size={28} />
                <span
                  className={`font-mono text-sm font-bold ${
                    c.me.points >= 0 ? "text-gold-300" : "text-danger-300"
                  }`}
                >
                  {pointsLabel(c.me.points)}
                </span>
                <span className="display text-xs text-lilac-400/60">vs</span>
                <span
                  className={`font-mono text-sm font-bold ${
                    c.opponent.points >= 0 ? "text-gold-300" : "text-danger-300"
                  }`}
                >
                  {pointsLabel(c.opponent.points)}
                </span>
                <ManagerAvatar config={parseAvatar(c.opponent.avatar)} size={28} />
                <span className="min-w-0 truncate text-sm font-bold text-white">
                  {c.opponent.username}
                </span>
              </div>

              {c.status === "pending" && !c.isMine ? (
                <div className="flex shrink-0 gap-1.5">
                  <button
                    onClick={() => respond(c.id, true)}
                    disabled={respondingId === c.id}
                    className="btn-press rounded-lg border-b-gold-800 bg-gold-400 px-2.5 py-1 text-xs font-extrabold text-night-950 hover:bg-gold-300 disabled:opacity-40"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => respond(c.id, false)}
                    disabled={respondingId === c.id}
                    className="btn-press rounded-lg border-b-night-950 bg-night-700 px-2.5 py-1 text-xs font-extrabold text-lilac-300 disabled:opacity-40"
                  >
                    Decline
                  </button>
                </div>
              ) : (
                <span
                  className={`stamp shrink-0 text-[10px] ${
                    c.status === "pending"
                      ? "text-lilac-300"
                      : c.status === "declined"
                        ? "text-danger-300"
                        : c.status === "completed"
                          ? c.won === null
                            ? "text-lilac-300"
                            : c.won
                              ? "text-turf-300"
                              : "text-danger-300"
                          : "text-gold-300"
                  }`}
                >
                  {c.status === "pending"
                    ? "Waiting"
                    : c.status === "declined"
                      ? "Declined"
                      : c.status === "completed"
                        ? c.won === null
                          ? "Tied"
                          : c.won
                            ? "Won"
                            : "Lost"
                        : "In play"}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
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
              ±{rpForOdds(myBet.odds)} pts riding
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
                : `${pointsLabel(myBet.rp_delta ?? 0)} pts`}
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
                    {odds ? `±${rpForOdds(odds)} pts` : "–"}
                  </span>
                </button>
              );
            })}
          </div>

          {sel && (
            <div className="pop-in mt-3 flex items-center justify-between gap-2 rounded-2xl border-2 border-gold-600/40 bg-night-800 px-3 py-2">
              <p className="text-xs font-bold text-lilac-200">
                {pickLabel(sel)} right{" "}
                <span className="font-mono text-turf-300">+{rpForOdds(oddsFor(sel)!)} pts</span>
                {" · "}wrong{" "}
                <span className="font-mono text-danger-300">−{rpForOdds(oddsFor(sel)!)} pts</span>
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
                {pointsLabel(s.points)} pts
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
                  {pointsLabel(s.points)} pts
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
