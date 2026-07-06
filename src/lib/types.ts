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
  challengeWins?: number;
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
  arena: {
    id: number;
    name: string;
    status: "open" | "settled";
    is_private: boolean;
    invite_code: string | null;
  };
  fixtures: Fixture[];
  entry: { points: number; final_rank: number | null } | null;
  myBets: ArenaBet[];
  standings: ArenaStanding[];
}

export interface Challenge {
  id: number;
  status: "pending" | "accepted" | "declined" | "completed";
  createdAt: string;
  resolvedAt: string | null;
  isMine: boolean;
  me: { id: number; username: string; avatar: string | null; points: number };
  opponent: { id: number; username: string; avatar: string | null; points: number };
  won: boolean | null;
}

export interface MyArenaSummary {
  id: number;
  name: string;
  status: "open" | "settled";
  inviteCode: string | null;
  points: number;
  finalRank: number | null;
  memberCount: number;
}

export interface ArenaResponse {
  current: ArenaInfo | null;
  lastSettled: ArenaInfo | null;
  me: { id: number; username: string; rp: number } | null;
  challenges: Challenge[];
  myLeagues: MyArenaSummary[];
}

export interface SingleArenaResponse {
  arena: ArenaInfo;
  challenges: Challenge[];
}

export interface Season {
  id: number;
  name: string;
  endsAt: string;
}

export interface LeaderboardResponse {
  players: {
    id: number;
    username: string;
    rp: number;
    arena_wins: number;
    challenge_wins: number;
    season_wins: number;
    avatar: string | null;
  }[];
  meId: number | null;
  season: Season;
}

export interface HallOfFameSeason {
  id: number;
  name: string;
  endsAt: string;
  top: { username: string; finalRp: number; finalRank: number; tier: string }[];
}

export interface HallOfFameResponse {
  seasons: HallOfFameSeason[];
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
