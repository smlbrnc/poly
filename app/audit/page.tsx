"use client";

import { useEffect, useState } from "react";

interface Entry { ts: string; action: string; details: Record<string, unknown>; }

export default function AuditPage() {
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    fetch("/api/audit?limit=100")
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setEntries(d));
  }, []);

  return (
    <div>
      <h1 style={{ marginBottom: "1rem" }}>Audit log</h1>
      <ul style={{ listStyle: "none", padding: 0, fontFamily: "monospace", fontSize: "0.875rem" }}>
        {entries.map((e, i) => (
          <li key={i} style={{ padding: "0.35rem 0", borderBottom: "1px solid #27272a" }}>
            <span style={{ color: "#71717a", marginRight: "0.5rem" }}>{e.ts}</span>
            <span style={{ color: "#a78bfa" }}>{e.action}</span>
            {Object.keys(e.details ?? {}).length > 0 && <span style={{ marginLeft: "0.5rem", color: "#a1a1aa" }}>{JSON.stringify(e.details)}</span>}
          </li>
        ))}
      </ul>
      {entries.length === 0 && <p style={{ color: "#71717a" }}>Kayıt yok</p>}
    </div>
  );
}
