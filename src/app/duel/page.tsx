"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Hud, Coin } from "@/components/Hud";
import { TeamBadge } from "@/components/TeamBadge";
import { Countdown } from "@/components/Countdown";
import { JoinGate } from "@/components/JoinGate";
import { ManagerAvatar } from "@/components/ManagerAvatar";
import { parseAvatar, DEFAULT_AVATAR } from "@/lib/avatar";
import { useMe } from "@/lib/MeContext";
import type { DuelResponse, DuelView, Selection } from "@/lib/types";

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

export default function DuelPage() {
  const { me, loaded: meLoaded, refresh: refreshMe } = useMe();
  const [data, setData] = useState<DuelResponse | null>(null);
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

  // Poll fast while searching or waiting on the opponent's seal; slow otherwise.
  useEffect(() => {
    load();
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      await load();
      const fast = phaseRef.current === "searching" || phaseRef.current === "waiting";
      timer = setTimeout(tick, fast ? SEARCH_POLL_MS : IDLE_POLL_MS);
    };
    timer = setTimeout(tick, SEARCH_POLL_MS);
    return () => clearTimeout(timer);
  }, [load]);

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

  const readyUp = async () => {
    setBusy(true);
    setNotice(null);
    const res = await fetch("/api/duel/ready", { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      setNotice({ kind: "err", text: (await res.json()).message ?? "Couldn't ready up." });
      return;
    }
    setData((d) => (d ? { ...d, duel: null } : d));
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
            1v1. Same match, sealed calls. Sharpest prediction takes the pot.
          </p>
          {record && record.played > 0 && (
            <p className="mt-1 font-mono text-sm text-lilac-400">
              Your record: <span className="font-bold text-gold-300">{record.wins}W</span> –{" "}
              {record.played - record.wins}L
            </p>
          )}
        </div>

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
                  {duel.result === "won" ? "🏆 YOU TOOK THE POT" : duel.result === "lost" ? "BEATEN AT THE WHISTLE" : "DEAD HEAT — POT SPLIT"}
                </p>
                <p className="mt-1 text-sm text-lilac-300">
                  {duel.fixture.home_team} {duel.fixture.home_score}–{duel.fixture.away_score}{" "}
                  {duel.fixture.away_team}
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
                  <p className="mt-3 flex items-center justify-center gap-1.5 font-mono text-lg font-bold text-gold-300">
                    +{duel.pot} <Coin />
                  </p>
                )}
              </div>
            )}
            {duel?.phase === "void" && (
              <div className="mb-6 rounded-3xl border-2 border-white/20 bg-night-800/60 p-5 text-center">
                <p className="display text-2xl text-white">DUEL VOIDED</p>
                <p className="mt-1 text-sm text-lilac-300">
                  That match never got a result — both antes refunded.
                </p>
              </div>
            )}

            {/* Ready up */}
            <div className="rounded-3xl border-2 border-gold-600/40 bg-night-800/80 p-6 text-center">
              <p className="text-5xl">⚔️</p>
              <h2 className="display mt-2 text-2xl text-white">READY FOR A SHOWDOWN?</h2>
              <ul className="mx-auto mt-3 max-w-md space-y-1.5 text-left text-sm text-lilac-300">
                <li>
                  <span className="font-bold text-gold-300">1.</span> Ante{" "}
                  <span className="font-mono font-bold text-gold-300">{data?.stake ?? 100}</span>{" "}
                  coins and ready up — you&apos;re paired with the next player searching.
                </li>
                <li>
                  <span className="font-bold text-gold-300">2.</span> You both get the same match:
                  the next <span className="font-bold text-white">big clash</span> — the tightest
                  odds on the slate.
                </li>
                <li>
                  <span className="font-bold text-gold-300">3.</span> Seal a secret call:
                  winner <span className="text-lilac-100">and</span> exact score. No peeking, no
                  edits.
                </li>
                <li>
                  <span className="font-bold text-gold-300">4.</span> Right call beats wrong call.
                  Both right (or both wrong)? Closest scoreline takes the whole pot.
                </li>
              </ul>
              <button
                onClick={readyUp}
                disabled={busy}
                className="btn-press mt-5 rounded-2xl border-b-gold-800 bg-gold-400 px-8 py-3 text-lg font-extrabold text-night-950 hover:bg-gold-300 disabled:opacity-50"
              >
                {busy ? "…" : "⚔️ Ready up"}
              </button>
            </div>
          </>
        ) : duel.phase === "searching" ? (
          <div className="rounded-3xl border-2 border-lilac-400/40 bg-night-800/80 p-8 text-center">
            <p className="animate-pulse text-5xl">🔎</p>
            <h2 className="display mt-3 text-2xl text-white">SEARCHING FOR AN OPPONENT…</h2>
            <p className="mt-2 text-sm text-lilac-300">
              Your <span className="font-mono font-bold text-gold-300">{duel.stake}</span>-coin ante
              is in. The moment another player readies up, you&apos;re on.
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
                <span className="ml-auto flex items-center gap-1 font-mono text-sm font-bold text-gold-300">
                  {duel.pot} <Coin size={14} />
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
      </main>
    </div>
  );
}
