/**
 * Alert kontrolü: drawdown, execution rate eşikleri. Uyarı geçmişi: data/alert_history.json. Ana proje kurallarına uyum.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { getDataRoot, loadEnv } from "./config.js";
import { sendAlertEmail } from "./alert-email.js";

const DATA_DIR = join(getDataRoot(), "data");
const ALERT_HISTORY_PATH = join(DATA_DIR, "alert_history.json");
const MAX_ALERT_HISTORY = 200;

function ts(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function appendAlertHistory(metricKey: string, threshold: number, message: string): void {
  try {
    ensureDataDir();
    let history: Array<{ ts: string; metric: string; threshold: number; message: string }> = [];
    if (existsSync(ALERT_HISTORY_PATH)) {
      try {
        history = JSON.parse(readFileSync(ALERT_HISTORY_PATH, "utf-8")) as typeof history;
      } catch {}
    }
    history.push({ ts: ts(), metric: metricKey, threshold, message });
    if (history.length > MAX_ALERT_HISTORY) history = history.slice(-MAX_ALERT_HISTORY);
    writeFileSync(ALERT_HISTORY_PATH, JSON.stringify(history), "utf-8");
  } catch {}
}

export function checkAlerts(
  metrics: Record<string, unknown>,
  config: Record<string, unknown> = {}
): string[] {
  const alertsConfig = (config.alerts as Record<string, unknown>) ?? {};
  const out: string[] = [];
  const drawdownPct = (metrics.drawdown_pct as number) ?? 0;
  const drawdownGt = (alertsConfig.drawdown_pct_gt as number) ?? 15;
  if (drawdownGt && drawdownPct > drawdownGt) {
    const msg = `Drawdown %${drawdownPct.toFixed(1)} > %${drawdownGt} eşiği`;
    out.push(msg);
    appendAlertHistory("drawdown_pct", drawdownGt, msg);
  }
  const executionRate = (metrics.execution_success_rate as number) ?? 0;
  const rateLt = alertsConfig.execution_rate_lt as number | undefined;
  const executionsCount = (metrics.executions_count as number) ?? 0;
  if (rateLt != null && executionRate < rateLt && executionsCount > 0) {
    const msg = `Execution başarı oranı %${executionRate.toFixed(1)} < %${rateLt} eşiği`;
    out.push(msg);
    appendAlertHistory("execution_rate_lt", rateLt, msg);
  }
  if (out.length) {
    const env = loadEnv() as Record<string, string>;
    void sendAlertEmail(out, env).catch(() => {});
  }
  return out;
}

export function getAlertHistory(limit = 50): Array<{ ts: string; metric: string; threshold: number; message: string }> {
  if (!existsSync(ALERT_HISTORY_PATH)) return [];
  try {
    const h = JSON.parse(readFileSync(ALERT_HISTORY_PATH, "utf-8")) as Array<{ ts: string; metric: string; threshold: number; message: string }>;
    return (Array.isArray(h) ? h.slice(-limit) : []).reverse();
  } catch {
    return [];
  }
}
