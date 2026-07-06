import { Pool, type PoolClient } from "pg";

// Singleton across Next.js HMR reloads
const g = globalThis as unknown as { __pitchbetPool?: Pool; __pitchbetMigrated?: boolean };

function pool(): Pool {
  if (!g.__pitchbetPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not set");
    g.__pitchbetPool = new Pool({
      connectionString,
      // Supabase pooled connections terminate TLS with a cert we don't need
      // to verify against a local CA bundle.
      ssl: { rejectUnauthorized: false },
    });
  }
  return g.__pitchbetPool;
}

/** Convert this codebase's `?` positional placeholders to Postgres `$1, $2, ...`. */
function toPgText(text: string): string {
  let i = 0;
  return text.replace(/\?/g, () => `$${++i}`);
}

export interface Queryable {
  one<T>(text: string, params?: unknown[]): Promise<T | undefined>;
  many<T>(text: string, params?: unknown[]): Promise<T[]>;
  exec(text: string, params?: unknown[]): Promise<{ rowCount: number }>;
}

function wrap(runner: Pool | PoolClient, skipSchemaCheck = false): Queryable {
  return {
    async one<T>(text: string, params: unknown[] = []) {
      if (!skipSchemaCheck) await ensureSchema();
      const res = await runner.query(toPgText(text), params);
      return res.rows[0] as T | undefined;
    },
    async many<T>(text: string, params: unknown[] = []) {
      if (!skipSchemaCheck) await ensureSchema();
      const res = await runner.query(toPgText(text), params);
      return res.rows as T[];
    },
    async exec(text: string, params: unknown[] = []) {
      if (!skipSchemaCheck) await ensureSchema();
      const res = await runner.query(toPgText(text), params);
      return { rowCount: res.rowCount ?? 0 };
    },
  };
}

/** The default (non-transactional) query surface. Ensures schema exists first. */
export function db(): Queryable {
  return wrap(pool());
}

/** Run a block of queries atomically on one checked-out connection. */
export async function withTx<T>(fn: (tx: Queryable) => Promise<T>): Promise<T> {
  await ensureSchema();
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    // Schema is already guaranteed above; skip the per-call check inside the tx.
    const result = await fn(wrap(client, true));
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** True when a unique-constraint violation caused a query to fail. */
export function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";
}

let migratePromise: Promise<void> | null = null;

/** Idempotent schema setup — safe to call on every cold start. */
export function ensureSchema(): Promise<void> {
  if (g.__pitchbetMigrated) return Promise.resolve();
  if (!migratePromise) {
    migratePromise = pool()
      .query(
        `
      CREATE TABLE IF NOT EXISTS players (
        id SERIAL PRIMARY KEY,
        token TEXT UNIQUE,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE,
        balance REAL NOT NULL DEFAULT 1000,
        rp INTEGER NOT NULL DEFAULT 0,
        arena_wins INTEGER NOT NULL DEFAULT 0,
        challenge_wins INTEGER NOT NULL DEFAULT 0,
        last_daily_at TEXT,
        password_hash TEXT,
        avatar TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      -- Already-deployed databases predate these columns; add if missing.
      ALTER TABLE players ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;
      ALTER TABLE players ADD COLUMN IF NOT EXISTS challenge_wins INTEGER NOT NULL DEFAULT 0;

      CREATE TABLE IF NOT EXISTS fixtures (
        id TEXT PRIMARY KEY,
        sport_key TEXT NOT NULL,
        sport_title TEXT NOT NULL,
        commence_time TEXT NOT NULL,
        home_team TEXT NOT NULL,
        away_team TEXT NOT NULL,
        home_odds REAL,
        draw_odds REAL,
        away_odds REAL,
        odds_updated_at TEXT,
        completed INTEGER NOT NULL DEFAULT 0,
        home_score INTEGER,
        away_score INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_fixtures_sport ON fixtures (sport_key, commence_time);

      CREATE TABLE IF NOT EXISTS bets (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES players(id),
        fixture_id TEXT NOT NULL REFERENCES fixtures(id),
        selection TEXT NOT NULL CHECK (selection IN ('home','draw','away')),
        stake REAL NOT NULL CHECK (stake > 0),
        odds REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','won','lost','void')),
        payout REAL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        settled_at TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS idx_bets_status ON bets (status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_bets_user ON bets (user_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS arenas (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','settled')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        settled_at TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS arena_fixtures (
        arena_id INTEGER NOT NULL REFERENCES arenas(id),
        fixture_id TEXT NOT NULL REFERENCES fixtures(id),
        PRIMARY KEY (arena_id, fixture_id)
      );

      CREATE TABLE IF NOT EXISTS arena_entries (
        arena_id INTEGER NOT NULL REFERENCES arenas(id),
        player_id INTEGER NOT NULL REFERENCES players(id),
        points INTEGER NOT NULL DEFAULT 0,
        final_rank INTEGER,
        joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (arena_id, player_id)
      );

      CREATE TABLE IF NOT EXISTS arena_bets (
        id SERIAL PRIMARY KEY,
        arena_id INTEGER NOT NULL REFERENCES arenas(id),
        player_id INTEGER NOT NULL REFERENCES players(id),
        fixture_id TEXT NOT NULL REFERENCES fixtures(id),
        selection TEXT NOT NULL CHECK (selection IN ('home','draw','away')),
        odds REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','won','lost','void')),
        rp_delta INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (arena_id, player_id, fixture_id)
      );

      CREATE TABLE IF NOT EXISTS challenges (
        id SERIAL PRIMARY KEY,
        arena_id INTEGER NOT NULL REFERENCES arenas(id),
        challenger_id INTEGER NOT NULL REFERENCES players(id),
        opponent_id INTEGER NOT NULL REFERENCES players(id),
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','completed')),
        winner_id INTEGER REFERENCES players(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        resolved_at TIMESTAMPTZ,
        UNIQUE (arena_id, challenger_id, opponent_id)
      );
      CREATE INDEX IF NOT EXISTS idx_challenges_opponent ON challenges (opponent_id, status);
      CREATE INDEX IF NOT EXISTS idx_challenges_challenger ON challenges (challenger_id, status);

      CREATE TABLE IF NOT EXISTS player_items (
        player_id INTEGER NOT NULL REFERENCES players(id),
        item_id TEXT NOT NULL,
        acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (player_id, item_id)
      );

      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `,
      )
      .then(() => {
        g.__pitchbetMigrated = true;
      });
  }
  return migratePromise;
}

export async function getMeta(key: string): Promise<string | null> {
  await ensureSchema();
  const row = await db().one<{ value: string }>("SELECT value FROM meta WHERE key = ?", [key]);
  return row?.value ?? null;
}

export async function setMeta(key: string, value: string): Promise<void> {
  await ensureSchema();
  await db().exec(
    "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
    [key, value],
  );
}

export interface PlayerRow {
  id: number;
  token: string | null;
  username: string;
  email: string | null;
  balance: number;
  rp: number;
  arena_wins: number;
  challenge_wins: number;
  last_daily_at: string | null;
  password_hash: string | null;
  avatar: string | null;
  created_at: string;
}

export interface FixtureRow {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  home_odds: number | null;
  draw_odds: number | null;
  away_odds: number | null;
  odds_updated_at: string | null;
  completed: number;
  home_score: number | null;
  away_score: number | null;
}

export interface BetRow {
  id: number;
  user_id: number;
  fixture_id: string;
  selection: "home" | "draw" | "away";
  stake: number;
  odds: number;
  status: "open" | "won" | "lost" | "void";
  payout: number | null;
  created_at: string;
  settled_at: string | null;
}

export interface ArenaRow {
  id: number;
  name: string;
  status: "open" | "settled";
  created_at: string;
  settled_at: string | null;
}

export interface ArenaEntryRow {
  arena_id: number;
  player_id: number;
  points: number;
  final_rank: number | null;
  joined_at: string;
}

export interface ArenaBetRow {
  id: number;
  arena_id: number;
  player_id: number;
  fixture_id: string;
  selection: "home" | "draw" | "away";
  odds: number;
  status: "open" | "won" | "lost" | "void";
  rp_delta: number | null;
  created_at: string;
}

export interface ChallengeRow {
  id: number;
  arena_id: number;
  challenger_id: number;
  opponent_id: number;
  status: "pending" | "accepted" | "declined" | "completed";
  winner_id: number | null;
  created_at: string;
  resolved_at: string | null;
}
