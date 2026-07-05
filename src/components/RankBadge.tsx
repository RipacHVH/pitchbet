import { tierFor } from "@/lib/ranks";

export function RankBadge({ rp, showRp = false }: { rp: number; showRp?: boolean }) {
  const tier = tierFor(rp);
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
      style={{
        color: tier.color,
        borderColor: `${tier.color}66`,
        background: `${tier.color}1a`,
        textShadow: "0 1px 2px rgba(0,0,0,.6)",
      }}
    >
      <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden>
        <path d="M6 0l1.8 3.6L12 4.2 9 7l.7 4L6 9.2 2.3 11l.7-4-3-2.8 4.2-.6z" fill={tier.color} />
      </svg>
      {tier.name}
      {showRp && <span className="opacity-80">· {rp} RP</span>}
    </span>
  );
}
