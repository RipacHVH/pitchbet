import { NextRequest, NextResponse } from "next/server";
import { withTx } from "@/lib/db";
import { currentPlayer } from "@/lib/identity";
import { itemById } from "@/lib/shop";

export async function POST(req: NextRequest) {
  const player = await currentPlayer();
  if (!player) return NextResponse.json({ message: "Log in first" }, { status: 401 });

  let body: { itemId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }
  const item = body.itemId ? itemById(body.itemId) : undefined;
  if (!item) return NextResponse.json({ message: "No such item" }, { status: 404 });

  try {
    const balance = await withTx(async (tx) => {
      const owned = await tx.one(
        "SELECT 1 FROM player_items WHERE player_id = ? AND item_id = ?",
        [player.id, item.id],
      );
      if (owned) throw new Error("ALREADY_OWNED");

      const debit = await tx.exec(
        "UPDATE players SET balance = balance - ? WHERE id = ? AND balance >= ?",
        [item.cost, player.id, item.cost],
      );
      if (debit.rowCount === 0) throw new Error("SHORT");
      await tx.exec("INSERT INTO player_items (player_id, item_id) VALUES (?, ?)", [
        player.id,
        item.id,
      ]);
      const row = await tx.one<{ balance: number }>(
        "SELECT balance FROM players WHERE id = ?",
        [player.id],
      );
      return row!.balance;
    });
    return NextResponse.json({ itemId: item.id, newBalance: balance });
  } catch (err) {
    if (err instanceof Error && err.message === "ALREADY_OWNED") {
      return NextResponse.json({ message: "Already owned" }, { status: 409 });
    }
    if (err instanceof Error && err.message === "SHORT") {
      return NextResponse.json(
        { message: `Not enough coins — ${item.name} costs ${item.cost.toLocaleString()}.` },
        { status: 409 },
      );
    }
    throw err;
  }
}
