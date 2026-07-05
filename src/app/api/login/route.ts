import { NextRequest, NextResponse } from "next/server";
import { loginPlayer } from "@/lib/identity";
import { tierFor } from "@/lib/ranks";

export async function POST(req: NextRequest) {
  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.username || !body.password) {
    return NextResponse.json({ message: "Player name and password are required" }, { status: 400 });
  }

  const result = await loginPlayer(body.username, body.password);
  if (result.error || !result.player) {
    return NextResponse.json({ message: result.error ?? "Login failed" }, { status: 401 });
  }
  const p = result.player;
  return NextResponse.json({
    username: p.username,
    balance: p.balance,
    rp: p.rp,
    tier: tierFor(p.rp).name,
  });
}
