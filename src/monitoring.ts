/**
 * İzleme: metrikler, event history, pipeline runs. Ana proje kurallarına uyum: data/ ana dizinde.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { getDataRoot } from "./config.js";

const DATA_DIR = join(getDataRoot(), "data");
const METRICS_PATH = join(DATA_DIR, "metrics.json");
const HISTORY_PATH = join(DATA_DIR, "metrics_history.json");
const EVENT_HISTORY_PATH = join(DATA_DIR, "event_history.json");
const PIPELINE_RUNS_PATH = join(DATA_DIR, "pipeline_runs.json");
const MAX_TIMESTAMPS = 120;
const MAX_HISTORY = 500;
const MAX_EVENT_HISTORY = 100;
const MAX_PIPELINE_RUNS = 30;

function ts(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

interface MetricsStore {
  opportunities_count: number;
  executions_count: number;
  executions_success: number;
  total_pnl: number;
  peak_pnl: number;
  avg_latency_ms: number;
  updated_at: string | null;
  opportunity_timestamps: string[];
  execution_timestamps: string[];
}

function loadMetrics(): MetricsStore {
  const defaultM: MetricsStore = {
    opportunities_count: 0,
    executions_count: 0,
    executions_success: 0,
    total_pnl: 0,
    peak_pnl: 0,
    avg_latency_ms: 0,
    updated_at: null,
    opportunity_timestamps: [],
    execution_timestamps: [],
  };
  if (!existsSync(METRICS_PATH)) return defaultM;
  try {
    const m = JSON.parse(readFileSync(METRICS_PATH, "utf-8")) as Partial<MetricsStore>;
    return {
      ...defaultM,
      ...m,
      opportunity_timestamps: m.opportunity_timestamps ?? [],
      execution_timestamps: m.execution_timestamps ?? [],
    };
  } catch {
    return defaultM;
  }
}

function saveMetrics(m: MetricsStore): void {
  ensureDataDir();
  m.updated_at = ts();
  writeFileSync(METRICS_PATH, JSON.stringify(m, null, 2), "utf-8");
  const peak = m.peak_pnl || 1;
  const drawdownPct = peak > 0 ? ((peak - m.total_pnl) / peak) * 100 : 0;
  const snap = {
    ts: m.updated_at,
    opportunities_count: m.opportunities_count,
    executions_count: m.executions_count,
    total_pnl: m.total_pnl,
    drawdown_pct: Math.round(drawdownPct * 100) / 100,
    avg_latency_ms: Math.round(m.avg_latency_ms * 100) / 100,
  };
  let history: unknown[] = [];
  if (existsSync(HISTORY_PATH)) {
    try {
      history = JSON.parse(readFileSync(HISTORY_PATH, "utf-8")) as unknown[];
    } catch {}
  }
  history.push(snap);
  if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY);
  writeFileSync(HISTORY_PATH, JSON.stringify(history), "utf-8");
}

export function recordOpportunity(): void {
  const m = loadMetrics();
  m.opportunities_count += 1;
  m.opportunity_timestamps = [...m.opportunity_timestamps.slice(-MAX_TIMESTAMPS), ts()];
  saveMetrics(m);
}

export function recordExecution(success: boolean, pnlUsd = 0, latencyMs = 0): void {
  const m = loadMetrics();
  m.executions_count += 1;
  if (success) m.executions_success += 1;
  m.total_pnl += pnlUsd;
  m.peak_pnl = Math.max(m.peak_pnl, m.total_pnl);
  const n = m.executions_count;
  const oldAvg = n > 1 ? m.avg_latency_ms * (n - 1) : 0;
  m.avg_latency_ms = n ? (oldAvg + latencyMs) / n : 0;
  m.execution_timestamps = [...m.execution_timestamps.slice(-MAX_TIMESTAMPS), ts()];
  saveMetrics(m);
}

export function recordEvent(eventType: string, detail: Record<string, unknown> = {}): void {
  ensureDataDir();
  let events: Array<{ ts: string; type: string; detail: Record<string, unknown> }> = [];
  if (existsSync(EVENT_HISTORY_PATH)) {
    try {
      events = JSON.parse(readFileSync(EVENT_HISTORY_PATH, "utf-8")) as typeof events;
    } catch {}
  }
  events.push({ ts: ts(), type: eventType, detail });
  if (events.length > MAX_EVENT_HISTORY) events = events.slice(-MAX_EVENT_HISTORY);
  writeFileSync(EVENT_HISTORY_PATH, JSON.stringify(events), "utf-8");
}

export function getEventHistory(limit = 50): Array<{ ts: string; type: string; detail: Record<string, unknown> }> {
  if (!existsSync(EVENT_HISTORY_PATH)) return [];
  try {
    const events = JSON.parse(readFileSync(EVENT_HISTORY_PATH, "utf-8")) as Array<{ ts: string; type: string; detail: Record<string, unknown> }>;
    return (Array.isArray(events) ? events.slice(-limit) : []).reverse();
  } catch {
    return [];
  }
}

export function recordPipelineRun(status: string, message = ""): void {
  ensureDataDir();
  let runs: Array<{ ts: string; status: string; message: string }> = [];
  if (existsSync(PIPELINE_RUNS_PATH)) {
    try {
      runs = JSON.parse(readFileSync(PIPELINE_RUNS_PATH, "utf-8")) as typeof runs;
    } catch {}
  }
  runs.push({ ts: ts(), status, message });
  if (runs.length > MAX_PIPELINE_RUNS) runs = runs.slice(-MAX_PIPELINE_RUNS);
  writeFileSync(PIPELINE_RUNS_PATH, JSON.stringify(runs), "utf-8");
}

export function getPipelineRuns(limit = 15): Array<{ ts: string; status: string; message: string }> {
  if (!existsSync(PIPELINE_RUNS_PATH)) return [];
  try {
    const runs = JSON.parse(readFileSync(PIPELINE_RUNS_PATH, "utf-8")) as Array<{ ts: string; status: string; message: string }>;
    return (Array.isArray(runs) ? runs.slice(-limit) : []).reverse();
  } catch {
    return [];
  }
}

function countLastMinute(timestamps: string[]): number {
  if (!timestamps.length) return 0;
  const cutoff = Date.now() / 1000 - 60;
  return timestamps.filter((t) => new Date(t.replace("Z", "+00:00")).getTime() / 1000 > cutoff).length;
}

export async function getMetrics(config?: Record<string, unknown>): Promise<Record<string, unknown>> {
  const m = loadMetrics();
  const ec = m.executions_count;
  const es = m.executions_success;
  const executionSuccessRate = ec ? (es / ec) * 100 : 0;
  const peak = m.peak_pnl || 1;
  const drawdownPct = peak > 0 ? ((peak - m.total_pnl) / peak) * 100 : 0;
  const out: Record<string, unknown> = {
    ...m,
    execution_success_rate: executionSuccessRate,
    drawdown_pct: drawdownPct,
    opportunities_per_min: countLastMinute(m.opportunity_timestamps),
    executions_per_min: countLastMinute(m.execution_timestamps),
  };
  const alertsConfig = config ?? (await import("./config.js").then((c) => c.loadYaml("monitoring")));
  const { checkAlerts } = await import("./alerts.js");
  out.alerts = checkAlerts(out, alertsConfig as Record<string, unknown>);
  return out;
}

export function getMetricsHistory(limit = 200): unknown[] {
  if (!existsSync(HISTORY_PATH)) return [];
  try {
    const h = JSON.parse(readFileSync(HISTORY_PATH, "utf-8")) as unknown[];
    return Array.isArray(h) ? h.slice(-limit) : [];
  } catch {
    return [];
  }
}
