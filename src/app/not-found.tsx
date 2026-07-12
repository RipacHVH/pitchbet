import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <p className="text-6xl">🥅</p>
      <h1 className="display mt-4 text-5xl text-white drop-shadow-[0_3px_0_rgba(0,0,0,.5)]">
        OFF <span className="text-gold-400">TARGET</span>
      </h1>
      <p className="mt-3 max-w-sm font-semibold text-lilac-300">
        That page sailed over the bar. The action&apos;s back on the pitch.
      </p>
      <Link
        href="/"
        className="btn-press mt-6 rounded-2xl border-b-gold-800 bg-gold-400 px-6 py-3 font-black text-night-950 hover:bg-gold-300"
      >
        ⚽ Back to Matchday
      </Link>
    </div>
  );
}
