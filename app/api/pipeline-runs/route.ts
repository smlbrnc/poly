import { NextRequest, NextResponse } from "next/server";
import { getPipelineRuns } from "../../../src/monitoring";

export async function GET(req: NextRequest) {
  try {
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "15", 10), 50);
    const data = getPipelineRuns(limit);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
