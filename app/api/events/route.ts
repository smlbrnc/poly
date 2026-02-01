import { NextRequest, NextResponse } from "next/server";
import { getEventHistory } from "../../../src/monitoring";

export async function GET(req: NextRequest) {
  try {
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "50", 10), 100);
    const data = getEventHistory(limit);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
