"use client";

import { useEffect, useState } from "react";

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<Record<string, unknown> | null>(null);
  const [runs, setRuns] = useState<Array<{ ts: string; status: string; message: string }>>([]);
  const [events, setEvents] = useState<Array<{ ts: string; type: string; detail: Record<string, unknown> }>>([]);

  useEffect(() => {
    const load = async () => {
      const [mRes, rRes, eRes] = await Promise.all([
        fetch("/api/metrics"),
        fetch("/api/pipeline-runs"),
        fetch("/api/events"),
      ]);
      if (mRes.ok) setMetrics(await mRes.json());
      if (rRes.ok) setRuns(await rRes.json());
      if (eRes.ok) setEvents(await eRes.json());
    };
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  return (
    <div>
      <h1 style={{ marginBottom: "1rem" }}>Kripto Dashboard</h1>

      {metrics && (
        <section style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "1rem", color: "#a1a1aa", marginBottom: "0.5rem" }}>Metrikler</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "0.75rem" }}>
            <Card label="Fırsat" value={String(metrics.opportunities_count ?? 0)} />
            <Card label="İşlem" value={String(metrics.executions_count ?? 0)} />
            <Card label="Başarı %" value={String(Number(metrics.execution_success_rate ?? 0).toFixed(1))} />
            <Card label="Toplam PnL (USD)" value={String(Number(metrics.total_pnl ?? 0).toFixed(2))} />
            <Card label="Drawdown %" value={String(Number(metrics.drawdown_pct ?? 0).toFixed(1))} />
            <Card label="Fırsat/dk" value={String(metrics.opportunities_per_min ?? 0)} />
          </div>
          {Array.isArray(metrics.alerts) && (metrics.alerts as string[]).length > 0 && (
            <div style={{ marginTop: "0.75rem", padding: "0.5rem", background: "#451a1a", borderRadius: 4 }}>
              Uyarılar: {(metrics.alerts as string[]).join("; ")}
            </div>
          )}
        </section>
      )}

      <section style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1rem", color: "#a1a1aa", marginBottom: "0.5rem" }}>Kontrol ve sorgu durumu</h2>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {runs.slice(0, 10).map((r, i) => (
            <li key={i} style={{ padding: "0.25rem 0", borderBottom: "1px solid #27272a" }}>
              <span style={{ color: "#71717a", marginRight: "0.5rem" }}>{r.ts}</span>
              <span style={{ color: r.status === "ok" ? "#22c55e" : r.status === "error" ? "#ef4444" : "#eab308" }}>{r.status}</span>
              {r.message && <span style={{ marginLeft: "0.5rem" }}>{r.message}</span>}
            </li>
          ))}
          {runs.length === 0 && <li style={{ color: "#71717a" }}>Kayıt yok</li>}
        </ul>
      </section>

      <section>
        <h2 style={{ fontSize: "1rem", color: "#a1a1aa", marginBottom: "0.5rem" }}>Son olaylar</h2>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {events.slice(0, 15).map((e, i) => (
            <li key={i} style={{ padding: "0.25rem 0", borderBottom: "1px solid #27272a" }}>
              <span style={{ color: "#71717a", marginRight: "0.5rem" }}>{e.ts}</span>
              <span>{e.type}</span>
              {Object.keys(e.detail).length > 0 && <span style={{ marginLeft: "0.5rem", color: "#a1a1aa" }}>{JSON.stringify(e.detail)}</span>}
            </li>
          ))}
          {events.length === 0 && <li style={{ color: "#71717a" }}>Olay kaydı yok</li>}
        </ul>
      </section>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: "0.75rem", background: "#18181b", borderRadius: 6 }}>
      <div style={{ fontSize: "0.75rem", color: "#71717a" }}>{label}</div>
      <div style={{ fontSize: "1.25rem" }}>{value}</div>
    </div>
  );
}
