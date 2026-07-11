"use client";

import { useCallback, useEffect, useState } from "react";
import { Coin } from "./Hud";
import { useMe } from "@/lib/MeContext";
import type { QuestsResponse, QuestView } from "@/lib/types";

/** This week's three quests with progress bars and one-time coin claims. */
export function QuestsCard() {
  const { me, refresh } = useMe();
  const [data, setData] = useState<QuestsResponse | null>(null);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/quests");
    if (res.ok) setData(await res.json());
  }, []);

  useEffect(() => {
    if (me?.joined) load();
  }, [me?.joined, load]);

  const claim = async (quest: QuestView) => {
    setClaiming(quest.id);
    const res = await fetch("/api/quests/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questId: quest.id }),
    });
    setClaiming(null);
    if (res.ok) {
      setFlash(quest.id);
      setTimeout(() => setFlash(null), 2500);
      await Promise.all([load(), refresh()]);
    }
  };

  if (!me?.joined || !data || data.quests.length === 0) return null;

  return (
    <section className="mb-6">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="display text-lg text-white">This week&apos;s quests</h2>
        <p className="text-[11px] font-bold text-lilac-400">New set every Monday</p>
      </div>
      <ul className="flex flex-col gap-2">
        {data.quests.map((q) => (
          <li
            key={q.id}
            className={`flex items-center gap-3 rounded-2xl border-2 px-3 py-2.5 ${
              q.claimed ? "border-white/10 bg-night-900/60 opacity-70" : "border-white/10 bg-night-800/80"
            }`}
          >
            <span className="text-2xl">{q.emoji}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-white">{q.title}</p>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-night-950/80">
                  <div
                    className={`h-full rounded-full ${q.claimed || q.claimable ? "bg-turf-400" : "bg-gold-400"}`}
                    style={{ width: `${Math.round((q.progress / q.target) * 100)}%` }}
                  />
                </div>
                <span className="shrink-0 font-mono text-[11px] font-bold text-lilac-300">
                  {q.progress}/{q.target}
                </span>
              </div>
            </div>
            {q.claimed ? (
              <span className="stamp shrink-0 text-[10px] text-turf-300">Done</span>
            ) : q.claimable ? (
              <button
                onClick={() => claim(q)}
                disabled={claiming === q.id}
                className="btn-press shrink-0 rounded-xl border-b-gold-800 bg-gold-400 px-3 py-1.5 text-xs font-black text-night-950 hover:bg-gold-300 disabled:opacity-40"
              >
                {flash === q.id ? "Nice!" : claiming === q.id ? "…" : `Claim ${q.reward}`}
              </button>
            ) : (
              <span className="flex shrink-0 items-center gap-1 font-mono text-xs font-bold text-lilac-400">
                {q.reward} <Coin size={12} />
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
