"use client";

import { useEffect, useState } from "react";

interface Entry {
  ts: string;
  action: string;
  details: Record<string, unknown>;
}

const ACTION_LABELS: Record<string, string> = {
  auto_trigger_attempt: "Otomatik tetikleme denemesi",
  auto_trigger_done: "Otomatik emir tamamlandı",
  auto_trigger_fail: "Otomatik emir reddedildi (Layer3/validasyon)",
  auto_trigger_skip: "Atlandı (tetikleyici Manuel)",
  auto_trigger_error: "Otomatik tetikleme hatası",
  auto_trigger_exec: "Otomatik emir gönderildi",
  auto_trigger_layer3_fail: "Otomatik Layer3 geçemedi",
  pipeline_queue_add: "Pipeline kuyruğa ekledi",
  queue_approve_exec: "Manuel onay ile emir gönderildi",
  execution_mode_change: "Config: işlem modu değişti",
};

function label(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

function actionColor(action: string): string {
  if (action.startsWith("auto_trigger_done") || action === "auto_trigger_exec" || action === "queue_approve_exec") return "#22c55e";
  if (action.startsWith("auto_trigger_fail") || action.startsWith("auto_trigger_error") || action === "auto_trigger_layer3_fail") return "#ef4444";
  if (action === "auto_trigger_skip") return "#71717a";
  if (action === "auto_trigger_attempt" || action === "pipeline_queue_add") return "#eab308";
  return "#a1a1aa";
}

export default function AutoLogsPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [config, setConfig] = useState<{ TRIGGER_MODE?: string; EXECUTION_MODE?: string } | null>(null);

  const load = () => {
    fetch("/api/audit?group=auto&limit=150")
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setEntries(d));
    fetch("/api/execution-mode", { method: "GET" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setConfig({ TRIGGER_MODE: d.TRIGGER_MODE, EXECUTION_MODE: d.EXECUTION_MODE }));
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, []);

  return (
    <div>
      <h1 style={{ marginBottom: "0.5rem" }}>Otomatik işlem logları</h1>
      <p style={{ fontSize: "0.875rem", color: "#a1a1aa", marginBottom: "1rem" }}>
        Pipeline ve otomatik tetikleyici akışını burada takip edebilirsiniz. Config&apos;te <strong>İşlem tetikleyici: Otomatik</strong> ise Layer 3 geçen fırsatlar otomatik emir gönderir.
      </p>
      {config && (
        <div style={{ display: "flex", gap: "1.5rem", marginBottom: "1rem", padding: "0.75rem", background: "#18181b", borderRadius: 8, fontSize: "0.875rem" }}>
          <span><strong>Tetikleyici:</strong> <span style={{ color: config.TRIGGER_MODE === "auto" ? "#22c55e" : "#eab308" }}>{config.TRIGGER_MODE === "auto" ? "Otomatik" : "Manuel"}</span></span>
          <span><strong>Ortam:</strong> {config.EXECUTION_MODE === "live" ? "Live" : config.EXECUTION_MODE === "paper" ? "Paper" : String(config.EXECUTION_MODE ?? "")}</span>
        </div>
      )}
      <ul style={{ listStyle: "none", padding: 0, fontFamily: "monospace", fontSize: "0.8125rem" }}>
        {entries.map((e, i) => (
          <li key={i} style={{ padding: "0.5rem 0", borderBottom: "1px solid #27272a", display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "baseline" }}>
            <span style={{ color: "#71717a", minWidth: "160px" }}>{e.ts}</span>
            <span style={{ color: actionColor(e.action), fontWeight: 600, minWidth: "220px" }}>{label(e.action)}</span>
            {Object.keys(e.details ?? {}).length > 0 && (
              <span style={{ color: "#a1a1aa" }}>{JSON.stringify(e.details)}</span>
            )}
          </li>
        ))}
      </ul>
      {entries.length === 0 && <p style={{ color: "#71717a", marginTop: "1rem" }}>Henüz otomatik işlem logu yok. Tetikleyici Otomatik ve pipeline çalışıyorsa burada kayıtlar görünür.</p>}
    </div>
  );
}
