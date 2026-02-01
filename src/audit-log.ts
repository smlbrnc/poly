/**
 * Audit log: logs/audit.log.
 */
import { appendFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const LOGS_DIR = join(ROOT, "logs");
const AUDIT_PATH = join(LOGS_DIR, "audit.log");
export const IS_VERCEL = process.env.VERCEL === "1";

function ensureLogsDir(): void {
  if (!existsSync(LOGS_DIR)) mkdirSync(LOGS_DIR, { recursive: true });
}

export function appendToAudit(action: string, details: Record<string, unknown> = {}): void {
  if (IS_VERCEL) return;
  ensureLogsDir();
  const entry = {
    ts: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    action,
    details,
  };
  appendFileSync(AUDIT_PATH, JSON.stringify(entry) + "\n", "utf-8");
}

export function readAuditLog(limit = 200, actionFilter?: string, actionSet?: Set<string>): Array<{ ts: string; action: string; details: Record<string, unknown> }> {
  if (IS_VERCEL || !existsSync(AUDIT_PATH)) return [];
  const out: Array<{ ts: string; action: string; details: Record<string, unknown> }> = [];
  try {
    const content = readFileSync(AUDIT_PATH, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim());
    const rev = lines.slice(-limit * 2).reverse();
    for (const line of rev) {
      try {
        const entry = JSON.parse(line) as { ts: string; action: string; details?: Record<string, unknown> };
        if (actionFilter && entry.action !== actionFilter) continue;
        if (actionSet && !actionSet.has(entry.action)) continue;
        out.push({ ts: entry.ts, action: entry.action, details: entry.details ?? {} });
        if (out.length >= limit) break;
      } catch {}
    }
    return out.reverse();
  } catch {
    return [];
  }
}

/** Otomatik işlem logları için kullanılan action listesi */
export const AUTO_LOG_ACTIONS = new Set([
  "auto_trigger_attempt", "auto_trigger_done", "auto_trigger_fail", "auto_trigger_skip", "auto_trigger_error",
  "auto_trigger_exec", "auto_trigger_layer3_fail", "pipeline_queue_add", "queue_approve_exec", "execution_mode_change",
]);
