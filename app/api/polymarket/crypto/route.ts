import { NextRequest, NextResponse } from "next/server";
import { fetchCryptoEvents, groupEventsByAsset } from "../../../../src/polymarket-gamma";

export async function GET(req: NextRequest) {
  try {
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "200", 10), 250);
    const events = await fetchCryptoEvents(limit);
    const { btc, eth, sol } = groupEventsByAsset(events);
    return NextResponse.json({
      btc,
      eth,
      sol,
      all: events.slice(0, 50),
      counts: { total: events.length, btc: btc.length, eth: eth.length, sol: sol.length },
    });
  } catch (e) {
    return NextResponse.json(
      { error: String(e), btc: [], eth: [], sol: [], all: [], counts: { total: 0, btc: 0, eth: 0, sol: 0 } },
      { status: 500 }
    );
  }
}
