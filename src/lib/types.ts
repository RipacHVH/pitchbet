export type Selection = "home" | "draw" | "away";

export interface Fixture {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  home_odds: number | null;
  draw_odds: number | null;
  away_odds: number | null;
  completed?: number;
  home_score?: number | null;
  away_score?: number | null;
}

export interface League {
  sportKey: string;
  sportTitle: string;
  fixtures: Fixture[];
}

export interface FixturesResponse {
  leagues: League[];
  refreshed: string[];
  creditsRemaining: number | null;
}

export interface Me {
  joined: boolean;
  username?: string;
  balance?: number;
  rp?: number;
  tier?: string;
  arenaWins?: number;
  openBets?: number;
  spinAvailable?: boolean;
  avatar?: import("./avatar").AvatarConfig;
  ownedItems?: string[];
}

export interface Bet {
  id: number;
  fixture_id: string;
  selection: Selection;
  stake: number;
  odds: number;
  status: "open" | "won" | "lost" | "void";
  payout: number | null;
  created_at: string;
  settled_at: string | null;
  home_team: string;
  away_team: string;
  commence_time: string;
  sport_title: string;
  completed: number;
  home_score: number | null;
  away_score: number | null;
}

export interface ArenaBet {
  id: number;
  fixture_id: string;
  selection: Selection;
  odds: number;
  status: "open" | "won" | "lost" | "void";
  rp_delta: number | null;
}

export interface ArenaStanding {
  player_id: number;
  username: string;
  rp: number;
  avatar: string | null;
  points: number;
  final_rank: number | null;
  picks: number;
}

export interface ArenaInfo {
  arena: { id: number; name: string; status: "open" | "settled" };
  fixtures: Fixture[];
  entry: { points: number; final_rank: number | null } | null;
  myBets: ArenaBet[];
  standings: ArenaStanding[];
}

export interface ArenaResponse {
  current: ArenaInfo | null;
  lastSettled: ArenaInfo | null;
  me: { id: number; username: string; rp: number } | null;
}

export interface LeaderboardResponse {
  players: { id: number; username: string; rp: number; arena_wins: number; avatar: string | null }[];
  meId: number | null;
}

export interface CareerRevealItem {
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  selection: Selection;
  odds: number;
  stake: number;
  payout: number;
  won: boolean;
}

export interface ArenaRevealItem {
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  selection: Selection;
  odds: number;
  rpDelta: number;
  won: boolean;
}

export interface SettleSummary {
  settled: number;
  won: number;
  lost: number;
  voided: number;
  arenasFinalized: number;
  scoresFetchedFor: string[];
  careerReveal: CareerRevealItem[];
  arenaReveal: ArenaRevealItem[];
  newBalance?: number;
}
