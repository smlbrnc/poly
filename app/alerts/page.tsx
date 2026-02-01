"use client";

import { useEffect, useState } from "react";

interface Alert { ts: string; metric: string; threshold: number; message: string; }

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    fetch("/api/alerts?limit=50")
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setAlerts(d));
  }, []);

  return (
    <div>
      <h1 style={{ marginBottom: "1rem" }}>Uyarı geçmişi</h1>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {alerts.map((a, i) => (
          <li key={i} style={{ padding: "0.5rem 0", borderBottom: "1px solid #27272a" }}>
            <span style={{ color: "#71717a", marginRight: "0.5rem" }}>{a.ts}</span>
            <span>{a.metric}</span> — {a.message}
          </li>
        ))}
      </ul>
      {alerts.length === 0 && <p style={{ color: "#71717a" }}>Kayıt yok</p>}
    </div>
  );
}
