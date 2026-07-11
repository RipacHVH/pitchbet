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
  me: { id: number; username: string; rp: number } | null;
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

export type DuelPhase = "searching" | "picking" | "waiting" | "locked" | "completed" | "void";

export interface DuelPick {
  selection: Selection;
  homeGoals: number;
  awayGoals: number;
}

export interface DuelDivision {
  id: string;
  name: string;
  emoji: string;
  entry: number;
  minRp: number;
  rpWin: number;
  rpLoss: number;
}

export interface DuelView {
  id: number;
  phase: DuelPhase;
  division: DuelDivision;
  stake: number;
  pot: number;
  fixture: Fixture | null;
  opponent: { id: number; username: string; avatar: string | null; duelWins: number } | null;
  myPick: DuelPick | null;
  theirPick: DuelPick | null;
  opponentLocked: boolean;
  result: "won" | "lost" | "split" | null;
  resolvedAt: string | null;
  queuedAt: string;
  estimatedWaitSeconds: number;
}

export interface DuelStats {
  wins: number;
  played: number;
  currentStreak: number;
  bestStreak: number;
  biggestPot: number;
}

export interface DuelResponse {
  duel: DuelView | null;
  record: DuelStats | null;
  divisions: DuelDivision[];
  tiers: { name: string; min: number; color: string }[];
  me?: { id: number; username: string; balance: number; rp: number; duelWins: number };
}

export interface QuestView {
  id: string;
  title: string;
  target: number;
  reward: number;
  emoji: string;
  progress: number;
  claimed: boolean;
  claimable: boolean;
}

export interface QuestsResponse {
  weekKey: string | null;
  quests: QuestView[];
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
