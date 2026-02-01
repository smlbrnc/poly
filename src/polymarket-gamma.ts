/**
 * Polymarket Gamma API: event/market verisi (BTC, ETH, SOL kripto).
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const GAMMA_BASE = "https://gamma-api.polymarket.com";
const CRYPTO_TAG_ID = "21";

export interface GammaMarket {
  id: string;
  question: string;
  slug: string;
  outcomePrices?: string;
  outcomes?: string;
  volume?: string;
  liquidity?: string;
  active?: boolean;
  closed?: boolean;
  clobTokenIds?: string;
}

export interface GammaEvent {
  id: string;
  slug: string;
  title: string;
  markets: GammaMarket[];
  volume?: number;
  liquidity?: number;
  tags?: Array<{ slug: string; label: string }>;
}

function parseOutcomePrices(outcomePrices: string | undefined): [number, number] {
  if (!outcomePrices) return [0.5, 0.5];
  try {
    const arr = JSON.parse(outcomePrices) as string[];
    return [parseFloat(arr[0] ?? "0.5"), parseFloat(arr[1] ?? "0.5")];
  } catch {
    return [0.5, 0.5];
  }
}

async function fetchEvents(params: { limit: number; order?: string; ascending?: boolean }): Promise<GammaEvent[]> {
  const { limit, order = "volume24hr", ascending = false } = params;
  const url = `${GAMMA_BASE}/events?tag_id=${CRYPTO_TAG_ID}&active=true&closed=false&limit=${limit}&order=${order}&ascending=${ascending}`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json", "User-Agent": "Polymarket-Arbitrage-Node/1.0" },
  });
  if (!res.ok) throw new Error(`Gamma API: ${res.status}`);
  const data = (await res.json()) as GammaEvent[];
  return Array.isArray(data) ? data : [];
}

export function loadCryptoEventsFromFixture(filePath: string): GammaEvent[] {
  const path = filePath.startsWith("/") ? filePath : join(process.cwd(), filePath);
  if (!existsSync(path)) return [];
  const raw = JSON.parse(readFileSync(path, "utf-8")) as { btc?: GammaEvent[]; eth?: GammaEvent[]; sol?: GammaEvent[] };
  const btc = Array.isArray(raw.btc) ? raw.btc : [];
  const eth = Array.isArray(raw.eth) ? raw.eth : [];
  const sol = Array.isArray(raw.sol) ? raw.sol : [];
  return [...btc, ...eth, ...sol];
}

export async function fetchCryptoEvents(limit = 150): Promise<GammaEvent[]> {
  const [byVolume, byNew] = await Promise.all([
    fetchEvents({ limit: Math.max(limit, 100), order: "volume24hr", ascending: false }),
    fetchEvents({ limit: 100, order: "id", ascending: false }),
  ]);
  const byId = new Map<string, GammaEvent>();
  for (const e of byVolume) byId.set(e.id, e);
  for (const e of byNew) if (!byId.has(e.id)) byId.set(e.id, e);
  return Array.from(byId.values());
}

export function groupEventsByAsset(events: GammaEvent[]): { btc: GammaEvent[]; eth: GammaEvent[]; sol: GammaEvent[] } {
  const btc: GammaEvent[] = [];
  const eth: GammaEvent[] = [];
  const sol: GammaEvent[] = [];
  const lower = (s: string) => s.toLowerCase();
  for (const e of events) {
    const t = lower(e.title);
    if (t.includes("bitcoin") || t.includes("btc")) btc.push(e);
    else if (t.includes("ethereum") || t.includes("eth ")) eth.push(e);
    else if (t.includes("solana") || t.includes(" sol ")) sol.push(e);
  }
  return { btc, eth, sol };
}

export function getMarketPrices(m: GammaMarket): { yes: number; no: number } {
  const [yes, no] = parseOutcomePrices(m.outcomePrices);
  return { yes, no };
}

export function getMarketLiquidityUsd(m: GammaMarket): number {
  if (m.liquidity == null || m.liquidity === "") return 0;
  const n = parseFloat(String(m.liquidity));
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

export function collectAssetIdsFromEvents(events: GammaEvent[], maxIds = 50): string[] {
  const ids = new Set<string>();
  for (const e of events) {
    if (!e.markets) continue;
    for (const m of e.markets) {
      if (!m.clobTokenIds) continue;
      try {
        const arr = JSON.parse(m.clobTokenIds) as string[];
        for (const id of arr) if (id) ids.add(id);
      } catch {
        // ignore
      }
      if (ids.size >= maxIds) return Array.from(ids);
    }
  }
  return Array.from(ids);
}
