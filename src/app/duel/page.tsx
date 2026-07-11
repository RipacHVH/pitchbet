"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Hud, Coin } from "@/components/Hud";
import { TeamBadge } from "@/components/TeamBadge";
import { Countdown } from "@/components/Countdown";
import { JoinGate } from "@/components/JoinGate";
import { ManagerAvatar } from "@/components/ManagerAvatar";
import { RankBadge } from "@/components/RankBadge";
import { HallOfFame, WorldRankings } from "@/components/RankedBoards";
import { parseAvatar, DEFAULT_AVATAR } from "@/lib/avatar";
import { tierFor, nextTier } from "@/lib/ranks";
import { useMe } from "@/lib/MeContext";
import type {
  DuelDivision,
  DuelResponse,
  DuelView,
  HallOfFameSeason,
  LeaderboardResponse,
  Selection,
} from "@/lib/types";

const SEARCH_POLL_MS = 3_000;
const IDLE_POLL_MS = 20_000;

function selectionLabel(duel: DuelView, sel: Selection): string {
  if (!duel.fixture) return sel;
  if (sel === "home") return duel.fixture.home_team;
  if (sel === "away") return duel.fixture.away_team;
  return "Draw";
}

/** A big stepper for calling the exact score. */
function GoalStepper({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="max-w-[7rem] truncate text-xs font-bold uppercase tracking-wide text-lilac-300">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(0, value - 1))}
          disabled={disabled || value <= 0}
          className="btn-press h-9 w-9 rounded-xl border-b-night-950 bg-night-600 text-lg font-extrabold text-lilac-200 hover:bg-night-500 disabled:opacity-40"
          aria-label={`fewer ${label} goals`}
        >
          −
        </button>
        <span className="w-10 text-center font-mono text-3xl font-bold text-white">{value}</span>
        <button
          onClick={() => onChange(Math.min(9, value + 1))}
          disabled={disabled || value >= 9}
          className="btn-press h-9 w-9 rounded-xl border-b-night-950 bg-night-600 text-lg font-extrabold text-lilac-200 hover:bg-night-500 disabled:opacity-40"
          aria-label={`more ${label} goals`}
        >
          +
        </button>
      </div>
    </div>
  );
}

/** Progress toward the next career tier, under the rank strip. */
function RankProgress({ rp }: { rp: number }) {
  const next = nextTier(rp);
  if (!next) {
    return (
      <p className="mt-1.5 text-xs font-bold text-gold-300">
        👑 Top of the ladder — nothing above Ballon d&apos;Or.
      </p>
    );
  }
  const current = tierFor(rp);
  const pct = Math.round(((rp - current.min) / (next.min - current.min)) * 100);
  return (
    <div className="mx-auto mt-2 w-full max-w-xs">
      <div className="h-2.5 overflow-hidden rounded-full bg-night-950/80">
        <div
          className="h-full rounded-full bg-gradient-to-r from-gold-600 to-gold-300"
          style={{ width: `${Math.max(3, pct)}%` }}
        />
      </div>
      <p className="mt-1 text-[11px] font-bold text-lilac-400">
        <span className="font-mono text-lilac-200">{next.min - rp} RP</span> to{" "}
        <span style={{ color: next.color }}>{next.name}</span>
      </p>
    </div>
  );
}

/** Full-screen moment when the player crosses into a new tier. */
function RankUpCelebration({ rp, meId }: { rp: number; meId: number }) {
  const [show, setShow] = useState<string | null>(null);

  useEffect(() => {
    const key = `futcaster-tier-${meId}`;
    const tier = tierFor(rp);
    const seen = window.localStorage.getItem(key);
    if (seen === null) {
      // First visit: remember where they are, celebrate only future climbs.
      window.localStorage.setItem(key, `${tier.min}`);
      return;
    }
    if (tier.min > Number(seen)) {
      window.localStorage.setItem(key, `${tier.min}`);
      setShow(tier.name);
    }
  }, [rp, meId]);

  if (!show) return null;
  const tier = tierFor(rp);
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-night-950/90 p-4 backdrop-blur-sm"
      onClick={() => setShow(null)}
    >
      <div className="pop-in flex w-full max-w-sm flex-col items-center rounded-3xl border-2 border-gold-600/70 bg-night-700 p-8 text-center shadow-[0_10px_0_rgba(0,0,0,.4)]">
        <p className="text-6xl">🎉</p>
        <p className="display mt-3 text-xl text-lilac-300">PROMOTED TO</p>
        <p className="display mt-1 text-4xl" style={{ color: tier.color }}>
          {show}
        </p>
        <p className="mt-3 text-sm font-bold text-lilac-300">
          Your calls got you here. Keep them sharp.
        </p>
        <button
          onClick={() => setShow(null)}
          className="btn-press mt-5 w-full rounded-2xl border-b-gold-800 bg-gold-400 px-6 py-2.5 font-black text-night-950 hover:bg-gold-300"
        >
          On we go
        </button>
      </div>
    </div>
  );
}

/** Live m:ss timer since the search began, with the matchmaking estimate. */
function SearchTimer({ queuedAt, estimateSeconds }: { queuedAt: string; estimateSeconds: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const elapsed = Math.max(0, Math.floor((now - Date.parse(queuedAt)) / 1000));
  const mm = Math.floor(elapsed / 60);
  const ss = `${elapsed % 60}`.padStart(2, "0");
  const overdue = elapsed > estimateSeconds;

  return (
    <div className="mt-4">
      <p className="font-mono text-4xl font-bold tabular-nums text-white">
        {mm}:{ss}
      </p>
      <p className="mt-1 text-xs font-bold text-lilac-400">
        {overdue ? "Any moment now…" : <>Estimated wait: ~{estimateSeconds}s</>}
      </p>
    </div>
  );
}

function SealedEnvelope({ locked, name }: { locked: boolean; name: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl border-2 border-dashed border-white/15 bg-night-800/60 px-4 py-3">
      <span className="text-2xl">{locked ? "✉️" : "✏️"}</span>
      <span className="text-xs font-bold text-lilac-300">
        {locked ? `${name} has sealed their call` : `${name} is still picking…`}
      </span>
    </div>
  );
}

function DivisionCard({
  division,
  myRp,
  balance,
  busy,
  onReady,
}: {
  division: DuelDivision;
  myRp: number;
  balance: number;
  busy: boolean;
  onReady: () => void;
}) {
  const rankLocked = myRp < division.minRp;
  const broke = !rankLocked && balance < division.entry;
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border-2 p-3 ${
        rankLocked ? "border-white/10 bg-night-900/60 opacity-60" : "border-gold-600/40 bg-night-800/80"
      }`}
    >
      <span className="text-3xl">{division.emoji}</span>
      <div className="min-w-0 flex-1">
        <p className="font-extrabold text-white">{division.name}</p>
        <p className="text-[11px] font-bold text-lilac-400">
          <span className="font-mono text-gold-300">{division.entry.toLocaleString()}</span> coins ·{" "}
          <span className="font-mono text-turf-300">+{division.rpWin}</span>/
          <span className="font-mono text-danger-300">−{division.rpLoss}</span> RP
          {division.minRp > 0 && <> · needs {division.minRp} RP</>}
        </p>
      </div>
      {rankLocked ? (
        <span className="stamp shrink-0 text-[10px] text-lilac-300">🔒 {division.minRp} RP</span>
      ) : (
        <button
          onClick={onReady}
          disabled={busy || broke}
          title={broke ? `You need ${division.entry} coins` : undefined}
          className="btn-press shrink-0 rounded-xl border-b-gold-800 bg-gold-400 px-4 py-2 text-sm font-black text-night-950 hover:bg-gold-300 disabled:opacity-40"
        >
          {broke ? "Low coins" : "Ready up"}
        </button>
      )}
    </div>
  );
}

export default function DuelPage() {
  const { me, loaded: meLoaded, refresh: refreshMe } = useMe();
  const [data, setData] = useState<DuelResponse | null>(null);
  const [board, setBoard] = useState<LeaderboardResponse | null>(null);
  const [hallOfFame, setHallOfFame] = useState<HallOfFameSeason[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // Sealed-call form state
  const [selection, setSelection] = useState<Selection | null>(null);
  const [homeGoals, setHomeGoals] = useState(1);
  const [awayGoals, setAwayGoals] = useState(0);

  const duel = data?.duel ?? null;
  const phaseRef = useRef<string | null>(null);
  phaseRef.current = duel?.phase ?? null;

  const load = useCallback(async () => {
    const res = await fetch("/api/duel");
    if (res.ok) setData(await res.json());
  }, []);

  const loadBoards = useCallback(async () => {
    const [boardRes, hofRes] = await Promise.all([
      fetch("/api/leaderboard"),
      fetch("/api/seasons/hall-of-fame"),
    ]);
    if (boardRes.ok) setBoard(await boardRes.json());
    if (hofRes.ok) setHallOfFame((await hofRes.json()).seasons);
  }, []);

  // Poll fast while searching or waiting on the opponent's seal; slow otherwise.
  useEffect(() => {
    load();
    loadBoards();
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      await load();
      const fast = phaseRef.current === "searching" || phaseRef.current === "waiting";
      timer = setTimeout(tick, fast ? SEARCH_POLL_MS : IDLE_POLL_MS);
    };
    timer = setTimeout(tick, SEARCH_POLL_MS);
    return () => clearTimeout(timer);
  }, [load, loadBoards]);

  // Keep the scoreline consistent with the call as the player switches outcome.
  const pickSelection = (sel: Selection) => {
    setSelection(sel);
    if (sel === "home" && homeGoals <= awayGoals) {
      setHomeGoals(awayGoals + 1);
    } else if (sel === "away" && awayGoals <= homeGoals) {
      setAwayGoals(homeGoals + 1);
    } else if (sel === "draw") {
      setAwayGoals(homeGoals);
    }
  };

  const readyUp = async (divisionId: string) => {
    setBusy(true);
    setNotice(null);
    const res = await fetch("/api/duel/ready", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ division: divisionId }),
    });
    setBusy(false);
    if (!res.ok) {
      setNotice({ kind: "err", text: (await res.json()).message ?? "Couldn't ready up." });
      return;
    }
    setData((d) => (d ? { ...d, duel: null } : d));
    await Promise.all([load(), refreshMe()]);
  };

  const requestRematch = async () => {
    setBusy(true);
    setNotice(null);
    const res = await fetch("/api/duel/rematch", { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      setNotice({ kind: "err", text: (await res.json()).message ?? "Couldn't set up the rematch." });
      return;
    }
    await Promise.all([load(), refreshMe()]);
  };

  const cancel = async () => {
    setBusy(true);
    const res = await fetch("/api/duel/cancel", { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      setNotice({ kind: "err", text: (await res.json()).message ?? "Couldn't cancel." });
    }
    await Promise.all([load(), refreshMe()]);
  };

  const sealPick = async () => {
    if (!selection) return;
    setBusy(true);
    setNotice(null);
    const res = await fetch("/api/duel/pick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selection, homeGoals, awayGoals }),
    });
    setBusy(false);
    if (!res.ok) {
      setNotice({ kind: "err", text: (await res.json()).message ?? "Couldn't seal your call." });
      return;
    }
    setNotice({ kind: "ok", text: "Sealed. No edits now — see you at the whistle." });
    await load();
  };

  const record = data?.record;
  const myRp = data?.me?.rp ?? 0;
  const balance = data?.me?.balance ?? 0;
  const oppAvatar = duel?.opponent?.avatar ? parseAvatar(duel.opponent.avatar) : DEFAULT_AVATAR;

  return (
    <div className="min-h-dvh">
      <Hud />
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-8">
        <div className="mb-2 text-center">
          <h1 className="display text-5xl text-white drop-shadow-[0_3px_0_rgba(0,0,0,.5)]">
            SHOW<span className="text-gold-400">DOWN</span>
          </h1>
          <p className="mt-2 text-lilac-300">
            The ranked mode. 1v1, same match, sealed calls — sharpest prediction takes the pot and
            climbs the ladder.
          </p>
          {data?.me && (
            <>
              <div className="mt-3 flex items-center justify-center gap-2">
                <span className="font-bold text-white">{data.me.username}</span>
                <RankBadge rp={myRp} showRp />
              </div>
              <RankProgress rp={myRp} />
              {record && record.played > 0 && (
                <div className="mx-auto mt-3 flex w-fit items-center gap-4 rounded-2xl border border-white/10 bg-night-800/80 px-4 py-2 font-mono text-xs font-bold text-lilac-300">
                  <span>
                    <span className="text-gold-300">{record.wins}W</span>–
                    {record.played - record.wins}L
                  </span>
                  {record.currentStreak >= 2 && (
                    <span className="text-turf-300">🔥 {record.currentStreak} streak</span>
                  )}
                  {record.bestStreak >= 2 && <span>best {record.bestStreak}</span>}
                  {record.biggestPot > 0 && (
                    <span className="flex items-center gap-1">
                      top pot {record.biggestPot.toLocaleString()} <Coin size={11} />
                    </span>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {data?.me && <RankUpCelebration rp={myRp} meId={data.me.id} />}

        {notice && (
          <div
            className={`mb-4 rounded-2xl border-2 px-4 py-3 text-sm font-bold ${
              notice.kind === "ok"
                ? "border-turf-400/60 bg-turf-900/60 text-turf-300"
                : "border-danger-400/60 bg-danger-900/60 text-danger-300"
            }`}
          >
            {notice.text}
          </div>
        )}

        {!meLoaded ? null : !me?.joined ? (
          <div className="mt-6">
            <JoinGate onJoined={() => Promise.all([refreshMe(), load()])} />
          </div>
        ) : !duel || duel.phase === "completed" || duel.phase === "void" ? (
          <>
            {/* Result banner for the duel that just finished */}
            {duel?.phase === "completed" && duel.fixture && (
              <div
                className={`mb-6 rounded-3xl border-2 p-5 text-center ${
                  duel.result === "won"
                    ? "border-turf-400/70 bg-turf-900/50"
                    : duel.result === "lost"
                      ? "border-danger-400/60 bg-danger-900/40"
                      : "border-white/20 bg-night-800/60"
                }`}
              >
                <p className="display text-3xl text-white">
                  {duel.result === "won"
                    ? "🏆 YOU TOOK THE POT"
                    : duel.result === "lost"
                      ? "BEATEN AT THE WHISTLE"
                      : "DEAD HEAT — POT SPLIT"}
                </p>
                <p className="mt-1 text-sm text-lilac-300">
                  {duel.division.emoji} {duel.division.name} · {duel.fixture.home_team}{" "}
                  {duel.fixture.home_score}–{duel.fixture.away_score} {duel.fixture.away_team}
                </p>
                <div className="mt-3 flex items-center justify-center gap-6 text-sm">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-lilac-400">Your call</p>
                    <p className="font-bold text-white">
                      {duel.myPick
                        ? `${selectionLabel(duel, duel.myPick.selection)} · ${duel.myPick.homeGoals}–${duel.myPick.awayGoals}`
                        : "No call (forfeit)"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-lilac-400">
                      {duel.opponent?.username ?? "Opponent"}
                    </p>
                    <p className="font-bold text-white">
                      {duel.theirPick
                        ? `${selectionLabel(duel, duel.theirPick.selection)} · ${duel.theirPick.homeGoals}–${duel.theirPick.awayGoals}`
                        : "No call (forfeit)"}
                    </p>
                  </div>
                </div>
                {duel.result === "won" && (
                  <p className="mt-3 flex items-center justify-center gap-2 font-mono text-lg font-bold">
                    <span className="flex items-center gap-1.5 text-gold-300">
                      +{duel.pot} <Coin />
                    </span>
                    <span className="text-turf-300">+{duel.division.rpWin} RP</span>
                  </p>
                )}
                {duel.result === "lost" && (
                  <p className="mt-3 font-mono text-lg font-bold text-danger-300">
                    −{duel.division.rpLoss} RP
                  </p>
                )}
                {duel.opponent && (
                  <button
                    onClick={requestRematch}
                    disabled={busy}
                    className="btn-press mt-4 rounded-2xl border-b-gold-800 bg-gold-400 px-6 py-2.5 font-black text-night-950 hover:bg-gold-300 disabled:opacity-50"
                  >
                    ⚔️ Rematch {duel.opponent.username}
                  </button>
                )}
              </div>
            )}
            {duel?.phase === "void" && (
              <div className="mb-6 rounded-3xl border-2 border-white/20 bg-night-800/60 p-5 text-center">
                <p className="display text-2xl text-white">DUEL VOIDED</p>
                <p className="mt-1 text-sm text-lilac-300">
                  That match never got a result — both entries refunded, ladder untouched.
                </p>
              </div>
            )}

            {/* Division picker */}
            <div className="rounded-3xl border-2 border-gold-600/40 bg-night-800/80 p-5">
              <div className="text-center">
                <p className="text-4xl">⚔️</p>
                <h2 className="display mt-1 text-2xl text-white">PICK YOUR DIVISION</h2>
                <p className="mx-auto mt-2 max-w-md text-xs text-lilac-300">
                  Ready up and you&apos;re paired with the next player searching your division. You
                  both get the <span className="font-bold text-white">next big clash</span> — the
                  tightest odds kicking off soonest — and seal a secret call: winner{" "}
                  <span className="text-lilac-100">and</span> exact score. Right call beats wrong;
                  both right (or wrong), closest scoreline takes the pot and the RP.
                </p>
              </div>
              <div className="mt-4 flex flex-col gap-2">
                {(data?.divisions ?? []).map((d) => (
                  <DivisionCard
                    key={d.id}
                    division={d}
                    myRp={myRp}
                    balance={balance}
                    busy={busy}
                    onReady={() => readyUp(d.id)}
                  />
                ))}
              </div>
            </div>
          </>
        ) : duel.phase === "searching" ? (
          <div className="rounded-3xl border-2 border-lilac-400/40 bg-night-800/80 p-8 text-center">
            <p className="animate-pulse text-5xl">🔎</p>
            <h2 className="display mt-3 text-2xl text-white">SEARCHING FOR AN OPPONENT…</h2>
            <SearchTimer queuedAt={duel.queuedAt} estimateSeconds={duel.estimatedWaitSeconds} />
            <p className="mt-3 text-sm text-lilac-300">
              {duel.division.emoji} <span className="font-bold text-white">{duel.division.name}</span>{" "}
              · your <span className="font-mono font-bold text-gold-300">{duel.stake.toLocaleString()}</span>-coin
              entry is in. The moment another player readies up here, you&apos;re on.
            </p>
            <button
              onClick={cancel}
              disabled={busy}
              className="btn-press mt-5 rounded-xl border-b-night-950 bg-night-600 px-5 py-2 text-sm font-extrabold text-lilac-200 hover:bg-night-500 disabled:opacity-50"
            >
              Cancel &amp; refund
            </button>
          </div>
        ) : (
          /* picking / waiting / locked — the duel card */
          <div className="rounded-3xl border-2 border-gold-600/40 bg-night-800/80 p-5">
            {/* Opponent strip */}
            {duel.opponent && (
              <div className="mb-4 flex items-center justify-center gap-3 rounded-2xl bg-night-900/70 px-4 py-2.5">
                <ManagerAvatar config={oppAvatar} size={36} />
                <div className="text-left">
                  <p className="text-sm font-extrabold text-white">{duel.opponent.username}</p>
                  <p className="text-xs text-lilac-400">{duel.opponent.duelWins} duel wins</p>
                </div>
                <span className="display ml-2 text-xl text-gold-400">VS YOU</span>
                <span className="ml-auto flex flex-col items-end">
                  <span className="flex items-center gap-1 font-mono text-sm font-bold text-gold-300">
                    {duel.pot.toLocaleString()} <Coin size={14} />
                  </span>
                  <span className="text-[10px] font-bold text-lilac-400">
                    {duel.division.emoji} {duel.division.name} · +{duel.division.rpWin}/−
                    {duel.division.rpLoss} RP
                  </span>
                </span>
              </div>
            )}

            {/* The big game */}
            {duel.fixture && (
              <div className="text-center">
                <p className="text-xs font-bold uppercase tracking-widest text-gold-400">
                  ⭐ The big clash
                </p>
                <div className="mt-2 flex items-center justify-center gap-5">
                  <div className="flex flex-col items-center gap-1">
                    <TeamBadge name={duel.fixture.home_team} size={48} />
                    <span className="max-w-[8rem] truncate text-sm font-extrabold text-white">
                      {duel.fixture.home_team}
                    </span>
                  </div>
                  <span className="display text-2xl text-lilac-400">VS</span>
                  <div className="flex flex-col items-center gap-1">
                    <TeamBadge name={duel.fixture.away_team} size={48} />
                    <span className="max-w-[8rem] truncate text-sm font-extrabold text-white">
                      {duel.fixture.away_team}
                    </span>
                  </div>
                </div>
                <p className="mt-1 text-xs text-lilac-300">
                  <Countdown iso={duel.fixture.commence_time} /> · seal your call before kickoff or
                  forfeit
                </p>
              </div>
            )}

            {duel.phase === "picking" && duel.fixture && (
              <div className="mt-5">
                <p className="mb-2 text-center text-xs font-bold uppercase tracking-wide text-lilac-300">
                  Your secret call
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {(["home", "draw", "away"] as Selection[]).map((sel) => (
                    <button
                      key={sel}
                      onClick={() => pickSelection(sel)}
                      className={`btn-press rounded-xl px-2 py-2.5 text-sm font-extrabold ${
                        selection === sel
                          ? "border-b-gold-600 bg-gold-400 text-night-950"
                          : "border-b-night-950 bg-night-600 text-lilac-200 hover:bg-night-500"
                      }`}
                    >
                      {selectionLabel(duel, sel)}
                    </button>
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-center gap-6">
                  <GoalStepper
                    label={duel.fixture.home_team}
                    value={homeGoals}
                    onChange={(v) => {
                      setHomeGoals(v);
                      if (selection === "draw") setAwayGoals(v);
                    }}
                  />
                  <span className="mt-4 font-mono text-2xl text-lilac-400">–</span>
                  <GoalStepper
                    label={duel.fixture.away_team}
                    value={awayGoals}
                    onChange={(v) => {
                      setAwayGoals(v);
                      if (selection === "draw") setHomeGoals(v);
                    }}
                  />
                </div>

                <div className="mt-3 text-center">
                  {duel.opponent && (
                    <SealedEnvelope locked={duel.opponentLocked} name={duel.opponent.username} />
                  )}
                  <button
                    onClick={sealPick}
                    disabled={busy || !selection}
                    className="btn-press mt-3 w-full rounded-2xl border-b-gold-800 bg-gold-400 px-6 py-3 text-lg font-extrabold text-night-950 hover:bg-gold-300 disabled:opacity-50"
                  >
                    {busy ? "…" : "🔒 Seal the call"}
                  </button>
                  {!selection && (
                    <p className="mt-1.5 text-xs text-lilac-400">Pick an outcome first.</p>
                  )}
                </div>
              </div>
            )}

            {duel.phase === "waiting" && duel.myPick && (
              <div className="mt-5 text-center">
                <div className="rounded-2xl border-2 border-turf-400/50 bg-turf-900/40 px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-turf-300">
                    Your call is sealed
                  </p>
                  <p className="mt-1 font-extrabold text-white">
                    {selectionLabel(duel, duel.myPick.selection)} · {duel.myPick.homeGoals}–
                    {duel.myPick.awayGoals}
                  </p>
                </div>
                <div className="mt-3">
                  {duel.opponent && (
                    <SealedEnvelope locked={duel.opponentLocked} name={duel.opponent.username} />
                  )}
                </div>
              </div>
            )}

            {duel.phase === "locked" && duel.myPick && duel.theirPick && (
              <div className="mt-5">
                <p className="mb-2 text-center text-xs font-bold uppercase tracking-widest text-gold-400">
                  Both calls sealed — revealed!
                </p>
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="rounded-2xl border-2 border-turf-400/50 bg-turf-900/40 px-3 py-3">
                    <p className="text-xs font-bold uppercase text-lilac-400">You</p>
                    <p className="mt-1 font-extrabold text-white">
                      {selectionLabel(duel, duel.myPick.selection)}
                    </p>
                    <p className="font-mono text-2xl font-bold text-gold-300">
                      {duel.myPick.homeGoals}–{duel.myPick.awayGoals}
                    </p>
                  </div>
                  <div className="rounded-2xl border-2 border-white/15 bg-night-900/60 px-3 py-3">
                    <p className="text-xs font-bold uppercase text-lilac-400">
                      {duel.opponent?.username}
                    </p>
                    <p className="mt-1 font-extrabold text-white">
                      {selectionLabel(duel, duel.theirPick.selection)}
                    </p>
                    <p className="font-mono text-2xl font-bold text-gold-300">
                      {duel.theirPick.homeGoals}–{duel.theirPick.awayGoals}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-center text-xs text-lilac-300">
                  Nothing to do but watch. Check back after full time and hit{" "}
                  <span className="font-bold text-lilac-100">Check results</span> on the Tickets
                  page.
                </p>
              </div>
            )}
          </div>
        )}

        {board && board.players.length > 0 && <WorldRankings board={board} />}
        <HallOfFame seasons={hallOfFame} />
      </main>
    </div>
  );
}
