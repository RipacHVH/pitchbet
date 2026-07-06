import { NextResponse } from "next/server";
import { listHallOfFame } from "@/lib/seasons";

export async function GET() {
  return NextResponse.json({ seasons: await listHallOfFame() });
}
