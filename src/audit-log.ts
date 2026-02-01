/**
 * Audit log: logs/audit.log.
 */
import { appendFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const LOGS_DIR = join(ROOT, "logs");
const AUDIT_PATH = join(LOGS_DIR, "audit.log");

function ensureLogsDir(): void {
  if (!existsSync(LOGS_DIR)) mkdirSync(LOGS_DIR, { recursive: true });
}

export function appendToAudit(action: string, details: Record<string, unknown> = {}): void {
  ensureLogsDir();
  const entry = {
    ts: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    action,
    details,
  };
  appendFileSync(AUDIT_PATH, JSON.stringify(entry) + "\n", "utf-8");
}

export function readAuditLog(limit = 200, actionFilter?: string): Array<{ ts: string; action: string; details: Record<string, unknown> }> {
  if (!existsSync(AUDIT_PATH)) return [];
  const out: Array<{ ts: string; action: string; details: Record<string, unknown> }> = [];
  try {
    const content = readFileSync(AUDIT_PATH, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim());
    const rev = lines.slice(-limit * 2).reverse();
    for (const line of rev) {
      try {
        const entry = JSON.parse(line) as { ts: string; action: string; details?: Record<string, unknown> };
        if (actionFilter && entry.action !== actionFilter) continue;
        out.push({ ts: entry.ts, action: entry.action, details: entry.details ?? {} });
        if (out.length >= limit) break;
      } catch {}
    }
    return out.reverse();
  } catch {
    return [];
  }
}
