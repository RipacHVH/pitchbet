import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentPlayer } from "@/lib/identity";
import { validateAvatar, type AvatarConfig } from "@/lib/avatar";

export async function POST(req: NextRequest) {
  const player = await currentPlayer();
  if (!player) return NextResponse.json({ message: "Log in first" }, { status: 401 });

  let config: AvatarConfig;
  try {
    config = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const owned = new Set(
    (
      await db().many<{ item_id: string }>(
        "SELECT item_id FROM player_items WHERE player_id = ?",
        [player.id],
      )
    ).map((r) => r.item_id),
  );

  const check = validateAvatar(config, owned);
  if (!check.ok) return NextResponse.json({ message: check.error }, { status: 400 });

  const clean: AvatarConfig = {
    skin: config.skin,
    hair: config.hair,
    hairColor: config.hairColor,
    kit: config.kit,
    head: config.head,
    extra: config.extra,
  };
  await db().exec("UPDATE players SET avatar = ? WHERE id = ?", [
    JSON.stringify(clean),
    player.id,
  ]);
  return NextResponse.json({ avatar: clean });
}
