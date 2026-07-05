import { NextRequest, NextResponse } from "next/server";
import { db, withTx, type FixtureRow } from "@/lib/db";
import { currentPlayer } from "@/lib/identity";
import { listBets } from "@/lib/settle";

const MIN_STAKE = 10;

export async function GET() {
  const player = await currentPlayer();
  if (!player) return NextResponse.json({ message: "Join first" }, { status: 401 });
  return NextResponse.json({ bets: await listBets(player.id) });
}

export async function POST(req: NextRequest) {
  const player = await currentPlayer();
  if (!player) return NextResponse.json({ message: "Pick a manager name first" }, { status: 401 });

  let body: { fixtureId?: string; selection?: string; stake?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const { fixtureId, selection, stake } = body;
  if (!fixtureId || !selection || !["home", "draw", "away"].includes(selection)) {
    return NextResponse.json({ message: "fixtureId and a valid selection are required" }, { status: 400 });
  }
  if (typeof stake !== "number" || !Number.isFinite(stake) || stake < MIN_STAKE) {
    return NextResponse.json({ message: `Minimum stake is ${MIN_STAKE} coins` }, { status: 400 });
  }

  const fixture = await db().one<FixtureRow>("SELECT * FROM fixtures WHERE id = ?", [fixtureId]);
  if (!fixture) return NextResponse.json({ message: "Fixture not found" }, { status: 404 });
  if (fixture.completed || Date.parse(fixture.commence_time) <= Date.now()) {
    return NextResponse.json({ message: "Betting is closed — the match has kicked off" }, { status: 409 });
  }

  // Odds are locked from the server-side cache, never trusted from the client.
  const oddsMap = { home: fixture.home_odds, draw: fixture.draw_odds, away: fixture.away_odds };
  const odds = oddsMap[selection as "home" | "draw" | "away"];
  if (!odds) return NextResponse.json({ message: "No odds available for this outcome" }, { status: 409 });

  const roundedStake = Math.round(stake * 100) / 100;

  try {
    const placed = await withTx(async (tx) => {
      const debit = await tx.exec(
        "UPDATE players SET balance = balance - ? WHERE id = ? AND balance >= ?",
        [roundedStake, player.id, roundedStake],
      );
      if (debit.rowCount === 0) throw new Error("INSUFFICIENT_FUNDS");
      const inserted = await tx.one<{ id: number }>(
        "INSERT INTO bets (user_id, fixture_id, selection, stake, odds) VALUES (?, ?, ?, ?, ?) RETURNING id",
        [player.id, fixtureId, selection, roundedStake, odds],
      );
      const row = await tx.one<{ balance: number }>("SELECT balance FROM players WHERE id = ?", [
        player.id,
      ]);
      return { betId: inserted!.id, balance: row!.balance };
    });

    return NextResponse.json({
      betId: placed.betId,
      odds,
      stake: roundedStake,
      potentialPayout: Math.round(roundedStake * odds * 100) / 100,
      newBalance: placed.balance,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "INSUFFICIENT_FUNDS") {
      return NextResponse.json({ message: "Insufficient balance" }, { status: 409 });
    }
    throw err;
  }
}
