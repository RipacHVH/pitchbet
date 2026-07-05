export interface Tier {
  name: string;
  min: number;
  color: string;
}

// A football career, bottom to top. RP thresholds are cumulative and sized
// for odds-based scoring (a pick is worth odds x 10 RP, so a strong
// gameweek nets roughly +40-90).
export const TIERS: Tier[] = [
  { name: "Sunday League", min: 0, color: "#9aa3b2" },
  { name: "Pub Team", min: 75, color: "#d08a4a" },
  { name: "Semi-Pro", min: 200, color: "#c3cede" },
  { name: "First Team", min: 400, color: "#ffc93c" },
  { name: "Club Legend", min: 750, color: "#b49bfa" },
  { name: "Ballon d'Or", min: 1200, color: "#ffe9a3" },
];

export function tierFor(rp: number): Tier {
  let tier = TIERS[0];
  for (const t of TIERS) if (rp >= t.min) tier = t;
  return tier;
}

export function nextTier(rp: number): Tier | null {
  return TIERS.find((t) => t.min > rp) ?? null;
}

/** RP riding on a pick: the odds, scaled to chunky integers. */
export function rpForOdds(odds: number): number {
  return Math.max(1, Math.round(odds * 10));
}
