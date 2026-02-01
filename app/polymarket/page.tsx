"use client";

import { useEffect, useState } from "react";

const POLYMARKET_BASE = "https://polymarket.com";

interface Market {
  id: string;
  question: string;
  slug: string;
  outcomePrices?: string;
  outcomes?: string;
  volume?: string;
  liquidity?: string;
  closed?: boolean;
}

interface Event {
  id: string;
  slug: string;
  title: string;
  markets: Market[];
  volume?: number;
  liquidity?: number;
}

interface CryptoData {
  btc: Event[];
  eth: Event[];
  sol: Event[];
  all?: Event[];
  counts?: { total: number; btc: number; eth: number; sol: number };
}

function parsePrices(outcomePrices: string | undefined): [number, number] {
  if (!outcomePrices) return [0.5, 0.5];
  try {
    const arr = JSON.parse(outcomePrices) as string[];
    return [parseFloat(arr[0] ?? "0.5"), parseFloat(arr[1] ?? "0.5")];
  } catch {
    return [0.5, 0.5];
  }
}

function MarketRow({ event, market }: { event: Event; market: Market }) {
  const [yes, no] = parsePrices(market.outcomePrices);
  const url = `${POLYMARKET_BASE}/event/${event.slug}`;
  return (
    <tr style={{ borderBottom: "1px solid #27272a" }}>
      <td style={{ padding: "0.5rem", maxWidth: 320 }}>
        <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: "#60a5fa" }}>
          {market.question?.slice(0, 70)}{market.question?.length > 70 ? "…" : ""}
        </a>
      </td>
      <td style={{ padding: "0.5rem", color: "#22c55e" }}>{(yes * 100).toFixed(0)}%</td>
      <td style={{ padding: "0.5rem", color: "#ef4444" }}>{(no * 100).toFixed(0)}%</td>
      <td style={{ padding: "0.5rem", color: "#71717a", fontSize: "0.875rem" }}>
        {market.volume ? `$${Number(market.volume).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}
      </td>
    </tr>
  );
}

function Section({ title, events, link, maxRows = 60 }: { title: string; events: Event[]; link: string; maxRows?: number }) {
  const all = events.flatMap((e) => e.markets.filter((m) => !m.closed).map((m) => ({ event: e, market: m })));
  const is15Min = (q: string) => /15\s*min/i.test(q);
  const isShortTerm = (q: string) => /hourly|4\s*hour|15\s*min|up or down/i.test(q);
  const shortTerm = all.filter(({ market }) => is15Min(market.question ?? "") || isShortTerm(market.question ?? ""));
  const rest = all.filter(({ market }) => !shortTerm.some((s) => s.market.id === market.id));
  const markets = [...shortTerm, ...rest].slice(0, maxRows);
  return (
    <section style={{ marginBottom: "2rem" }}>
      <h2 style={{ fontSize: "1.125rem", marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
        {title}
        <a href={link} target="_blank" rel="noopener noreferrer" style={{ color: "#60a5fa", fontSize: "0.875rem" }}>
          Polymarket’te aç →
        </a>
      </h2>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #3f3f46", color: "#71717a" }}>
              <th style={{ textAlign: "left", padding: "0.5rem" }}>Piyasa</th>
              <th style={{ textAlign: "right", padding: "0.5rem" }}>Evet</th>
              <th style={{ textAlign: "right", padding: "0.5rem" }}>Hayır</th>
              <th style={{ textAlign: "right", padding: "0.5rem" }}>Hacim</th>
            </tr>
          </thead>
          <tbody>
            {markets.map(({ event, market }) => (
              <MarketRow key={market.id} event={event} market={market} />
            ))}
          </tbody>
        </table>
      </div>
      {markets.length === 0 && <p style={{ color: "#71717a" }}>Bu varlık için açık piyasa yok.</p>}
    </section>
  );
}

export default function PolymarketPage() {
  const [data, setData] = useState<CryptoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    fetch("/api/polymarket/crypto?limit=200")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  if (loading) return <p style={{ color: "#71717a" }}>Polymarket verileri yükleniyor…</p>;
  if (error) return <p style={{ color: "#ef4444" }}>Hata: {error}</p>;
  if (!data) return null;

  const counts = data.counts ?? { total: 0, btc: data.btc?.length ?? 0, eth: data.eth?.length ?? 0, sol: data.sol?.length ?? 0 };
  const hasGrouped = (counts.btc + counts.eth + counts.sol) > 0;
  const allEvents = data.all ?? [];

  return (
    <div>
      <h1 style={{ marginBottom: "0.5rem" }}>Polymarket Kripto Piyasaları</h1>
      <p style={{ color: "#71717a", marginBottom: "0.5rem", fontSize: "0.875rem" }}>
        Veriler <a href="https://gamma-api.polymarket.com" target="_blank" rel="noopener noreferrer" style={{ color: "#60a5fa" }}>Gamma API</a> üzerinden canlı çekilir. Kaynak:{" "}
        <a href="https://polymarket.com/crypto/bitcoin" target="_blank" rel="noopener noreferrer" style={{ color: "#60a5fa" }}>polymarket.com/crypto</a>
      </p>
      <p style={{ color: "#22c55e", marginBottom: "0.5rem", fontSize: "0.875rem" }}>
        Gamma’dan {counts.total} event çekildi (BTC: {counts.btc}, ETH: {counts.eth}, SOL: {counts.sol}).
      </p>
      <p style={{ color: "#a1a1aa", marginBottom: "1.5rem", fontSize: "0.8125rem" }}>
        Bu sayfadaki veriler pipeline tarafından analiz ediliyor (aynı Gamma API, BTC/ETH/SOL). En az 2 piyasası olan event’lerde çiftler taranır; arbitraj bulunursa <a href="/manual-queue" style={{ color: "#60a5fa" }}>Manuel Kuyruk</a>’ta listelenir.
      </p>
      {hasGrouped && (
        <>
          <Section title="Bitcoin (BTC)" events={data.btc} link={`${POLYMARKET_BASE}/crypto/bitcoin`} />
          <Section title="Ethereum (ETH)" events={data.eth} link={`${POLYMARKET_BASE}/crypto/ethereum`} />
          <Section title="Solana (SOL)" events={data.sol} link={`${POLYMARKET_BASE}/crypto/solana`} />
        </>
      )}
      {!hasGrouped && allEvents.length > 0 && (
        <Section title="Tüm piyasalar (Gamma API)" events={allEvents} link={`${POLYMARKET_BASE}/crypto`} maxRows={80} />
      )}
      {!hasGrouped && allEvents.length === 0 && (
        <p style={{ color: "#f59e0b" }}>Gamma API’den veri gelmedi. API erişimini veya tag_id=21 filtresini kontrol edin.</p>
      )}
    </div>
  );
}
