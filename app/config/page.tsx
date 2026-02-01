"use client";

import { useEffect, useState } from "react";

export default function ConfigPage() {
  const [risk, setRisk] = useState<Record<string, unknown>>({});
  const [mode, setMode] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [r, m] = await Promise.all([
        fetch("/api/config?name=risk_params").then((x) => x.json()),
        fetch("/api/execution-mode").then((x) => x.json()),
      ]);
      if (r && !r.error) setRisk(r);
      if (m && !m.error) setMode(m);
    })();
  }, []);

  const saveRisk = async () => {
    setSaving(true);
    await fetch("/api/config", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ risk_params: risk }) });
    setSaving(false);
  };

  const setExecutionMode = async (value: string) => {
    await fetch("/api/execution-mode", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: value }) });
    setMode((m) => ({ ...m, EXECUTION_MODE: value }));
  };

  const setTriggerMode = async (value: string) => {
    await fetch("/api/execution-mode", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trigger_mode: value }) });
    setMode((m) => ({ ...m, TRIGGER_MODE: value }));
  };

  return (
    <div>
      <h1 style={{ marginBottom: "1rem" }}>Config</h1>
      <section style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1rem", color: "#a1a1aa", marginBottom: "0.5rem" }}>İşlem tetikleyici (SOP §4.6.3)</h2>
        <select
          value={String(mode.TRIGGER_MODE ?? "manual")}
          onChange={(e) => setTriggerMode(e.target.value)}
          style={{ padding: "0.5rem", background: "#18181b", color: "#e4e4e7", border: "1px solid #27272a", borderRadius: 4, marginRight: "0.5rem" }}
        >
          <option value="manual">Manuel — Fırsatlar kuyruğa; execution panelden onay ile</option>
          <option value="auto">Otomatik — Layer 3 geçen fırsatlar otomatik execution</option>
        </select>
      </section>
      <section style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1rem", color: "#a1a1aa", marginBottom: "0.5rem" }}>Ortam (Paper / Live)</h2>
        <select
          value={String(mode.EXECUTION_MODE ?? "paper")}
          onChange={(e) => setExecutionMode(e.target.value)}
          style={{ padding: "0.5rem", background: "#18181b", color: "#e4e4e7", border: "1px solid #27272a", borderRadius: 4 }}
        >
          <option value="paper">Paper — Simülasyon (gerçek emir gönderilmez)</option>
          <option value="live">Live — Gerçek emir Polymarket CLOB</option>
        </select>
        <p style={{ fontSize: "0.75rem", color: "#71717a", marginTop: "0.25rem" }}>
          Live için .env'de POLYMARKET_API_KEY, POLYMARKET_API_SECRET, POLYMARKET_PASSPHRASE, PRIVATE_KEY gerekli.
        </p>
      </section>
      <section>
        <h2 style={{ fontSize: "1rem", color: "#a1a1aa", marginBottom: "0.5rem" }}>Risk params (YAML)</h2>
        <pre style={{ background: "#18181b", padding: "1rem", borderRadius: 6, overflow: "auto", fontSize: "0.875rem" }}>{JSON.stringify(risk, null, 2)}</pre>
        <button onClick={saveRisk} disabled={saving} style={{ marginTop: "0.5rem", padding: "0.5rem 1rem", background: "#3b82f6", border: "none", borderRadius: 4, color: "#fff" }}>Kaydet</button>
      </section>
    </div>
  );
}
