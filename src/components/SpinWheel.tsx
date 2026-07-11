"use client";

import { useRef, useState } from "react";
import { Coin } from "./Hud";

const SEGMENTS = [25, 50, 75, 100, 150, 250, 500, 1000];
const COLORS = ["#322473", "#41318c", "#322473", "#41318c", "#322473", "#41318c", "#322473", "#b8860b"];
const SEG_ANGLE = 360 / SEGMENTS.length;

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function segmentPath(index: number): string {
  const start = index * SEG_ANGLE;
  const end = start + SEG_ANGLE;
  const [x1, y1] = polar(100, 100, 96, start);
  const [x2, y2] = polar(100, 100, 96, end);
  return `M100 100 L${x1} ${y1} A96 96 0 0 1 ${x2} ${y2} Z`;
}

export function SpinWheel({
  onDone,
  onClose,
}: {
  onDone: (prize: number, newBalance: number) => void;
  onClose: () => void;
}) {
  const [spinning, setSpinning] = useState(false);
  const [prize, setPrize] = useState<number | null>(null);
  const [streak, setStreak] = useState<{ days: number; bonus: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const doneRef = useRef(false);

  const spin = async () => {
    setSpinning(true);
    setError(null);
    const res = await fetch("/api/spin", { method: "POST" });
    if (!res.ok) {
      setSpinning(false);
      setError((await res.json()).message ?? "Spin failed — try again.");
      return;
    }
    const body: {
      prize: number;
      index: number;
      streakDays: number;
      streakBonus: number;
      newBalance: number;
    } = await res.json();

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finish = () => {
      setPrize(body.prize);
      setStreak({ days: body.streakDays, bonus: body.streakBonus });
      onDone(body.prize + body.streakBonus, body.newBalance);
    };
    // Land the winning segment's centre under the top pointer.
    const target = 5 * 360 + (360 - (body.index * SEG_ANGLE + SEG_ANGLE / 2));
    if (reduced) {
      setRotation(target % 360);
      finish();
      return;
    }
    setRotation(target);
    setTimeout(() => {
      if (doneRef.current) return;
      doneRef.current = true;
      finish();
    }, 4300);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-night-950/85 p-4 backdrop-blur-sm">
      <div className="pop-in flex w-full max-w-sm flex-col items-center rounded-3xl border-2 border-white/15 bg-night-700 p-6 shadow-[0_10px_0_rgba(0,0,0,.4)]">
        <h2 className="display text-2xl text-white">Daily spin</h2>
        <p className="mb-4 mt-1 text-sm font-semibold text-lilac-300">
          One spin a day. Jackpot pays 1,000.
        </p>

        <div className="relative">
          {/* pointer */}
          <div
            className="absolute -top-1 left-1/2 z-10 -translate-x-1/2"
            style={{
              width: 0,
              height: 0,
              borderLeft: "12px solid transparent",
              borderRight: "12px solid transparent",
              borderTop: "18px solid #ffc93c",
              filter: "drop-shadow(0 2px 2px rgba(0,0,0,.5))",
            }}
          />
          <svg
            width="240"
            height="240"
            viewBox="0 0 200 200"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? "transform 4.2s cubic-bezier(0.12, 0.8, 0.16, 1)" : undefined,
            }}
          >
            {SEGMENTS.map((value, i) => (
              <g key={i}>
                <path d={segmentPath(i)} fill={COLORS[i]} stroke="#140e33" strokeWidth="1.5" />
                <text
                  x={polar(100, 100, 66, i * SEG_ANGLE + SEG_ANGLE / 2)[0]}
                  y={polar(100, 100, 66, i * SEG_ANGLE + SEG_ANGLE / 2)[1]}
                  fill={value === 1000 ? "#140e33" : "#ffd968"}
                  fontSize="15"
                  fontWeight="800"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${i * SEG_ANGLE + SEG_ANGLE / 2} ${polar(100, 100, 66, i * SEG_ANGLE + SEG_ANGLE / 2)[0]} ${polar(100, 100, 66, i * SEG_ANGLE + SEG_ANGLE / 2)[1]})`}
                >
                  {value}
                </text>
              </g>
            ))}
            <circle cx="100" cy="100" r="97" fill="none" stroke="#ffc93c" strokeWidth="4" />
            <circle cx="100" cy="100" r="14" fill="#ffc93c" stroke="#8a5f06" strokeWidth="2" />
          </svg>
        </div>

        {prize !== null ? (
          <div className="pop-in mt-4 text-center">
            <p className="display text-3xl text-gold-300">
              +{prize.toLocaleString()} <Coin size={22} />
            </p>
            {streak && streak.bonus > 0 && (
              <p className="mt-0.5 text-sm font-bold text-turf-300">
                🔥 {streak.days}-day streak: +{streak.bonus} bonus
              </p>
            )}
            {streak && streak.bonus === 0 && streak.days === 1 && (
              <p className="mt-0.5 text-xs font-bold text-lilac-400">
                Spin again tomorrow to start a streak (+15/day, up to +75)
              </p>
            )}
            <p className="text-sm font-bold text-lilac-300">
              {prize >= 1000 ? "JACKPOT! Scenes." : prize >= 250 ? "Big spin!" : "In the bank."}
            </p>
            <button
              onClick={onClose}
              className="btn-press mt-3 w-full rounded-2xl border-b-gold-800 bg-gold-400 px-6 py-2.5 font-black text-night-950 hover:bg-gold-300"
            >
              Collect
            </button>
          </div>
        ) : (
          <>
            {error && <p className="mt-3 text-sm font-bold text-danger-300">{error}</p>}
            <div className="mt-4 flex w-full gap-2">
              <button
                onClick={onClose}
                disabled={spinning}
                className="btn-press rounded-2xl border-b-night-950 bg-night-600 px-4 py-2.5 font-extrabold text-lilac-200 disabled:opacity-40"
              >
                Later
              </button>
              <button
                onClick={spin}
                disabled={spinning}
                className="btn-press flex-1 rounded-2xl border-b-gold-800 bg-gold-400 py-2.5 text-lg font-black text-night-950 hover:bg-gold-300 disabled:opacity-60"
              >
                {spinning ? "Spinning…" : "SPIN"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
