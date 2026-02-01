import { NextResponse } from "next/server";
import { getMetrics } from "../../../src/monitoring";

export async function GET() {
  try {
    const data = await getMetrics();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
