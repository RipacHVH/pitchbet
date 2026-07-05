"use client";

import { useState } from "react";

export function JoinGate({
  onJoined,
  modal = false,
  onClose,
}: {
  onJoined: () => void;
  modal?: boolean;
  onClose?: () => void;
}) {
  const [mode, setMode] = useState<"new" | "login">("new");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch(mode === "new" ? "/api/join" : "/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        mode === "new" ? { username: name, email, password } : { username: name, password },
      ),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json()).message ?? "Something went wrong.");
      return;
    }
    onJoined();
  };

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSubmit =
    name.trim().length >= 3 && password.length >= 6 && (mode === "login" || emailValid);

  const card = (
    <div className="pop-in w-full max-w-sm rounded-3xl border-2 border-white/15 bg-night-700 p-6 text-center shadow-[0_10px_0_rgba(0,0,0,.4)]">
      <p className="text-4xl">🧢</p>
      <h2 className="display mt-2 text-2xl text-white">
        {mode === "new" ? "Take the job" : "Back in the dugout"}
      </h2>
      <p className="mt-1 text-sm font-semibold text-lilac-300">
        {mode === "new"
          ? "Every legend starts in the Sunday League."
          : "Log in from any device — your career follows you."}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-1 rounded-2xl bg-night-900 p-1">
        {(["new", "login"] as const).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={`rounded-xl py-1.5 text-sm font-extrabold transition ${
              mode === m ? "bg-gold-400 text-night-950" : "text-lilac-300 hover:text-white"
            }`}
          >
            {m === "new" ? "New manager" : "Log in"}
          </button>
        ))}
      </div>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Manager name"
        maxLength={16}
        autoFocus
        aria-label="Manager name"
        className="mt-3 w-full rounded-2xl border-2 border-white/15 bg-night-900 px-4 py-3 text-center font-bold text-white placeholder:text-lilac-400/50 focus:border-gold-400 focus:outline-none"
      />
      {mode === "new" && (
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email address"
          aria-label="Email address"
          className="mt-2 w-full rounded-2xl border-2 border-white/15 bg-night-900 px-4 py-3 text-center font-bold text-white placeholder:text-lilac-400/50 focus:border-gold-400 focus:outline-none"
        />
      )}
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && canSubmit && submit()}
        placeholder="Password (6+ characters)"
        aria-label="Password"
        className="mt-2 w-full rounded-2xl border-2 border-white/15 bg-night-900 px-4 py-3 text-center font-bold text-white placeholder:text-lilac-400/50 focus:border-gold-400 focus:outline-none"
      />
      {error && <p className="mt-2 text-sm font-bold text-danger-300">{error}</p>}
      <button
        onClick={submit}
        disabled={busy || !canSubmit}
        className="btn-press mt-4 w-full rounded-2xl border-b-gold-800 bg-gold-400 py-3 text-lg font-black text-night-950 hover:bg-gold-300 disabled:opacity-40"
      >
        {busy
          ? "One moment…"
          : mode === "new"
            ? "Start my career"
            : "Log in"}
      </button>
      {modal && onClose && (
        <button onClick={onClose} className="mt-3 text-xs font-bold text-lilac-400 hover:text-lilac-200">
          Not now
        </button>
      )}
    </div>
  );

  if (!modal) return <div className="flex justify-center py-8">{card}</div>;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-night-950/80 p-4 backdrop-blur-sm">
      {card}
    </div>
  );
}
