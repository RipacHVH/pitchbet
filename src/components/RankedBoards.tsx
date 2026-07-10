"use client";

import { Countdown } from "./Countdown";
import { ManagerAvatar } from "./ManagerAvatar";
import { RankBadge } from "./RankBadge";
import { parseAvatar } from "@/lib/avatar";
import type { HallOfFameSeason, LeaderboardResponse } from "@/lib/types";

/* Ranked-mode boards: the global RP ladder and past-season podiums.
   Lived on the Arena page back when arenas were ranked; the ladder is
   driven by Showdown duels now, so these render on /duel. */

export function WorldRankings({ board }: { board: LeaderboardResponse }) {
  return (
    <section className="mt-10">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="display text-lg text-white">World rankings</h2>
        <p className="text-[11px] font-bold text-lilac-400">
          {board.season.name} · <Countdown iso={board.season.endsAt} prefix="ends in" />
        </p>
      </div>
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
              {p.challenge_wins > 0 && (
                <span className="ml-2 text-xs font-bold text-lilac-300">⚔️ {p.challenge_wins}</span>
              )}
              {p.season_wins > 0 && (
                <span className="ml-2 text-xs font-bold text-lilac-300">🎖️ {p.season_wins}</span>
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

const MEDAL = ["🥇", "🥈", "🥉"];

export function HallOfFame({ seasons }: { seasons: HallOfFameSeason[] }) {
  if (seasons.length === 0) return null;
  return (
    <section className="mt-10">
      <h2 className="display mb-3 text-lg text-white">Hall of fame</h2>
      <ul className="flex flex-col gap-2">
        {seasons.map((s) => (
          <li
            key={s.id}
            className="rounded-2xl border-2 border-white/10 bg-night-800/80 px-4 py-3"
          >
            <p className="mb-1.5 text-xs font-extrabold uppercase tracking-widest text-lilac-400">
              {s.name}
            </p>
            <div className="flex flex-col gap-1">
              {s.top.map((t) => (
                <p key={t.finalRank} className="flex items-center gap-2 text-sm font-bold text-white">
                  <span>{MEDAL[t.finalRank - 1] ?? "🎖️"}</span>
                  <span className="min-w-0 flex-1 truncate">{t.username}</span>
                  <span className="font-mono text-gold-300">{t.finalRp} RP</span>
                  <span className="text-[10px] font-bold text-lilac-400">{t.tier}</span>
                </p>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
