import { cookies } from "next/headers";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { db, ensureSchema, type PlayerRow } from "./db";

const COOKIE = "pb_token";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export async function currentPlayer(): Promise<PlayerRow | null> {
  await ensureSchema();
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  return (await db().one<PlayerRow>("SELECT * FROM players WHERE token = ?", [token])) ?? null;
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

async function setSession(playerId: number): Promise<void> {
  const token = randomUUID();
  await db().exec("UPDATE players SET token = ? WHERE id = ?", [token, playerId]);
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

export interface AuthResult {
  player?: PlayerRow;
  error?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function registerPlayer(
  rawName: string,
  email: string,
  password: string,
): Promise<AuthResult> {
  await ensureSchema();
  const username = rawName.trim().replace(/\s+/g, " ");
  if (!/^[A-Za-z0-9 _.-]{3,16}$/.test(username)) {
    return { error: "Name must be 3–16 characters: letters, numbers, spaces." };
  }
  const normalizedEmail = (email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(normalizedEmail)) {
    return { error: "Enter a valid email address." };
  }
  if (typeof password !== "string" || password.length < 6) {
    return { error: "Password needs at least 6 characters." };
  }

  const existingName = await db().one<{ id: number }>(
    "SELECT id FROM players WHERE lower(username) = lower(?)",
    [username],
  );
  if (existingName) return { error: "That name is already managing a club. Pick another or log in." };

  const existingEmail = await db().one<{ id: number }>(
    "SELECT id FROM players WHERE lower(email) = lower(?)",
    [normalizedEmail],
  );
  if (existingEmail) return { error: "That email is already registered. Log in instead." };

  const created = await db().one<{ id: number }>(
    "INSERT INTO players (username, email, password_hash) VALUES (?, ?, ?) RETURNING id",
    [username, normalizedEmail, hashPassword(password)],
  );
  const playerId = created!.id;
  await setSession(playerId);
  return { player: (await db().one<PlayerRow>("SELECT * FROM players WHERE id = ?", [playerId]))! };
}

/**
 * Log in. Pre-accounts players (created name-only) have no password yet —
 * their first login sets it and claims the account.
 */
export async function loginPlayer(rawName: string, password: string): Promise<AuthResult> {
  await ensureSchema();
  const username = rawName.trim().replace(/\s+/g, " ");
  const player = await db().one<PlayerRow>("SELECT * FROM players WHERE lower(username) = lower(?)", [
    username,
  ]);
  if (!player) return { error: "No manager by that name. Create one instead." };

  if (player.password_hash === null) {
    if (typeof password !== "string" || password.length < 6) {
      return { error: "Set a password of at least 6 characters to claim this account." };
    }
    await db().exec("UPDATE players SET password_hash = ? WHERE id = ?", [
      hashPassword(password),
      player.id,
    ]);
  } else if (typeof password !== "string" || !verifyPassword(password, player.password_hash)) {
    return { error: "Wrong password." };
  }

  await setSession(player.id);
  return { player: (await db().one<PlayerRow>("SELECT * FROM players WHERE id = ?", [player.id]))! };
}
