"use client";

import { useEffect, useState } from "react";

interface Item {
  id?: number;
  status?: string;
  market_a?: string;
  market_b?: string;
  [key: string]: unknown;
}

const CRYPTO_KEYWORDS = ["bitcoin", "ethereum", "solana", "btc", " eth ", " sol "];
function isCryptoItem(x: Item): boolean {
  const text = `${x.market_a ?? ""} ${x.market_b ?? ""}`.toLowerCase();
  return CRYPTO_KEYWORDS.some((k) => text.includes(k));
}

interface PipelineRun {
  ts: string;
  status: string;
  message: string;
}

export default function ManualQueuePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [lastRun, setLastRun] = useState<PipelineRun | null>(null);
  const [cryptoOnly, setCryptoOnly] = useState(true);
  const [pendingOnly, setPendingOnly] = useState(true);
  const displayItems = cryptoOnly ? items.filter(isCryptoItem) : items;

  const load = async () => {
    const url = pendingOnly ? "/api/manual-queue?pending=true" : "/api/manual-queue";
    const res = await fetch(url);
    if (res.ok) setItems(await res.json());
    const runsRes = await fetch("/api/pipeline-runs?limit=1");
    if (runsRes.ok) {
      const runs = (await runsRes.json()) as PipelineRun[];
      if (runs.length) setLastRun(runs[0]);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [pendingOnly]);

  const [message, setMessage] = useState<string | null>(null);

  const act = async (action: "approve" | "reject" | "reopen", id: number) => {
    setMessage(null);
    const res = await fetch("/api/manual-queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, id }),
    });
    const data = await res.json();
    if (!res.ok && data?.reason) setMessage(`Layer 3 red: ${data.reason}`);
    else if (res.ok && action === "approve") {
      const msg = data.message ?? "";
      const isPaper = data.execution_mode === "paper" || /^paper:/i.test(msg);
      if (isPaper) setMessage("Paper modda — gerçek emir gönderilmedi. Polymarket'e düşmesi için Config sayfasından Ortam: Live seçin.");
      else if (!data.success) setMessage(msg ? `Emir reddedildi: ${msg}` : "Emir gönderilemedi.");
      else setMessage(data.executed ? `Emir gönderildi. ${msg}` : msg || "Kayıt onaylandı.");
    } else if (res.ok && action === "reopen") setMessage("Kayıt bekletmeye alındı; tekrar onaylayabilirsiniz.");
    load();
  };

  return (
    <div>
      <h1 style={{ marginBottom: "1rem" }}>Manuel Kuyruk (SOP §4.2, §4.6.3)</h1>
      <p style={{ fontSize: "0.875rem", color: "#a1a1aa", marginBottom: "0.75rem" }}>
        Emrin Polymarket&apos;e gitmesi için <strong>Config</strong> sayfasından <strong>Ortam: Live</strong> seçili olmalı (Paper = sadece simülasyon).
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", marginBottom: "0.75rem" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#a1a1aa", fontSize: "0.875rem" }}>
          <input type="checkbox" checked={pendingOnly} onChange={(e) => setPendingOnly(e.target.checked)} />
          Sadece bekleyenler (onaylanmamış)
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#a1a1aa", fontSize: "0.875rem" }}>
          <input type="checkbox" checked={cryptoOnly} onChange={(e) => setCryptoOnly(e.target.checked)} />
          Sadece kripto (Bitcoin / Ethereum / Solana)
        </label>
      </div>
      {message && <p style={{ color: "#f59e0b", marginBottom: "0.5rem" }}>{message}</p>}
      <ul style={{ listStyle: "none", padding: 0 }}>
        {displayItems.map((x) => (
          <li key={x.id ?? 0} style={{ padding: "0.75rem", background: "#18181b", borderRadius: 6, marginBottom: "0.5rem" }}>
            <div><strong>#{x.id}</strong> {x.status}</div>
            <div style={{ fontSize: "0.875rem", color: "#a1a1aa" }}>A: {String(x.market_a ?? "").slice(0, 60)}</div>
            <div style={{ fontSize: "0.875rem", color: "#a1a1aa" }}>B: {String(x.market_b ?? "").slice(0, 60)}</div>
            <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {x.status === "pending" && (
                <>
                  <button onClick={() => act("approve", x.id!)} style={{ padding: "0.25rem 0.5rem", background: "#22c55e", border: "none", borderRadius: 4 }}>Onayla</button>
                  <button onClick={() => act("reject", x.id!)} style={{ padding: "0.25rem 0.5rem", background: "#ef4444", border: "none", borderRadius: 4 }}>Reddet</button>
                </>
              )}
              {(x.status === "approved" || x.status === "rejected") && (
                <button onClick={() => act("reopen", x.id!)} style={{ padding: "0.25rem 0.5rem", background: "#3b82f6", border: "none", borderRadius: 4 }}>Bekletmeye al (tekrar onaylanacak)</button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {displayItems.length === 0 && (
        <div style={{ color: "#71717a", marginTop: "1rem" }}>
          <p><strong>
            {pendingOnly ? "Bekleyen kayıt yok." : cryptoOnly ? "Kripto kayıt yok." : "Kayıt yok."}
          </strong> {pendingOnly ? "Tüm kayıtları görmek için «Sadece bekleyenler» kutusunu kapatın." : "Pipeline Gamma API (tag_id=21) ile kripto event'leri tarar; arbitraj bulunursa burada listelenir."}</p>
          {lastRun && (
            <p style={{ fontSize: "0.875rem", marginTop: "0.5rem", color: "#a1a1aa" }}>
              Son tarama: {new Date(lastRun.ts).toLocaleString("tr-TR")} — {lastRun.message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
