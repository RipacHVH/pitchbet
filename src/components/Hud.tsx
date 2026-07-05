"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { JoinGate } from "./JoinGate";
import { ManagerAvatar } from "./ManagerAvatar";
import { DEFAULT_AVATAR, type AvatarConfig } from "@/lib/avatar";

export function Coin({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className="inline-block shrink-0">
      <circle cx="12" cy="12" r="11" fill="#d99a14" />
      <circle cx="12" cy="11" r="10" fill="url(#coinGrad)" />
      <defs>
        <radialGradient id="coinGrad" cx="0.35" cy="0.3" r="1">
          <stop offset="0" stopColor="#ffe9a3" />
          <stop offset="0.55" stopColor="#ffc93c" />
          <stop offset="1" stopColor="#e8a81c" />
        </radialGradient>
      </defs>
      <path
        d="M12 5.5l1.7 3.6 3.8.5-2.8 2.7.7 3.9L12 14.3l-3.4 1.9.7-3.9-2.8-2.7 3.8-.5z"
        fill="#8a5f06"
      />
    </svg>
  );
}

export function Hud({
  balance,
  openBets,
  pulse = false,
  joined = false,
  username,
  avatar,
  onAuthChange,
}: {
  balance: number | null;
  openBets: number;
  pulse?: boolean;
  joined?: boolean;
  username?: string;
  avatar?: AvatarConfig;
  onAuthChange?: () => void;
}) {
  const pathname = usePathname();
  const [authMode, setAuthMode] = useState<"new" | "login" | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  const logout = async () => {
    setLoggingOut(true);
    await fetch("/api/logout", { method: "POST" });
    setLoggingOut(false);
    setMenuOpen(false);
    onAuthChange?.();
  };

  const handleJoined = () => {
    setAuthMode(null);
    onAuthChange?.();
  };

  const tab = (href: string, label: string) => (
    <Link
      href={href}
      className={`btn-press whitespace-nowrap rounded-xl px-3 py-1.5 text-sm font-extrabold ${
        pathname === href
          ? "border-b-gold-600 bg-gold-400 text-night-950"
          : "border-b-night-950 bg-night-600 text-lilac-200 hover:bg-night-500"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-white/10 bg-night-900/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-4 py-3">
        <div className="flex items-center gap-2">
          <Link href="/" className="display mr-1 text-xl text-white drop-shadow-[0_2px_0_rgba(0,0,0,.6)]">
            Pitch<span className="text-gold-400">Bet</span>
          </Link>
          {tab("/", "Play")}
          {tab("/arena", "Arena")}
          {tab("/shop", "Shop")}
          {tab("/bets", `Tickets${openBets > 0 ? ` · ${openBets}` : ""}`)}
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`flex items-center gap-1.5 rounded-full border border-gold-600/60 bg-night-800 py-1.5 pl-2 pr-3 font-mono text-sm font-bold text-gold-300 shadow-[inset_0_2px_6px_rgba(0,0,0,.5)] ${
              pulse ? "coin-pulse" : ""
            }`}
          >
            <Coin />
            {balance === null ? "…" : Math.round(balance).toLocaleString()}
          </span>

          {joined ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="Account menu"
                aria-expanded={menuOpen}
                className="btn-press flex items-center gap-1.5 rounded-full border-b-night-950 bg-night-600 py-1 pl-1 pr-2.5 hover:bg-night-500"
              >
                <ManagerAvatar config={avatar ?? DEFAULT_AVATAR} size={26} />
                <span className="max-w-[6rem] truncate text-sm font-extrabold text-lilac-100">
                  {username}
                </span>
              </button>
              {menuOpen && (
                <div className="pop-in absolute right-0 top-[calc(100%+8px)] w-40 overflow-hidden rounded-2xl border-2 border-white/15 bg-night-700 shadow-[0_8px_0_rgba(0,0,0,.35)]">
                  <button
                    onClick={logout}
                    disabled={loggingOut}
                    className="w-full px-4 py-2.5 text-left text-sm font-extrabold text-lilac-200 hover:bg-night-600 disabled:opacity-50"
                  >
                    {loggingOut ? "Logging out…" : "Log out"}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setAuthMode("login")}
                className="btn-press whitespace-nowrap rounded-xl border-b-night-950 bg-night-600 px-3 py-1.5 text-sm font-extrabold text-lilac-200 hover:bg-night-500"
              >
                Log in
              </button>
              <button
                onClick={() => setAuthMode("new")}
                className="btn-press whitespace-nowrap rounded-xl border-b-gold-800 bg-gold-400 px-3 py-1.5 text-sm font-extrabold text-night-950 hover:bg-gold-300"
              >
                Sign up
              </button>
            </div>
          )}
        </div>
      </div>
      </header>

      {authMode && (
        <JoinGate
          modal
          initialMode={authMode}
          onJoined={handleJoined}
          onClose={() => setAuthMode(null)}
        />
      )}
    </>
  );
}
