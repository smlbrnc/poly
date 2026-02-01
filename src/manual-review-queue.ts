/**
 * Manuel doğrulama kuyruğu: data/manual_review_queue.json.
 * Ana proje kurallarına uyum: polymarket-arbitrage-node içinden çalışınca ana dizindeki (polymarket/) data/ kullanılır.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { getDataRoot } from "./config.js";
import { appendToAudit } from "./audit-log.js";

function getQueuePath(): string {
  return join(getDataRoot(), "data", "manual_review_queue.json");
}

function ensureDataDir(): void {
  const dir = join(getDataRoot(), "data");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export interface QueueItem {
  id?: number;
  status?: string;
  market_a?: string;
  market_b?: string;
  [key: string]: unknown;
}

function load(): QueueItem[] {
  const path = getQueuePath();
  if (!existsSync(path)) return [];
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as QueueItem[];
  } catch {
    return [];
  }
}

function save(items: QueueItem[]): void {
  ensureDataDir();
  writeFileSync(getQueuePath(), JSON.stringify(items, null, 2), "utf-8");
}

export function add(item: QueueItem): number {
  const items = load();
  const id = items.length + 1;
  items.push({ ...item, id, status: "pending" });
  save(items);
  return id;
}

export function getAll(): QueueItem[] {
  return load();
}

export function getPending(): QueueItem[] {
  return load().filter((x) => x.status === "pending");
}

export function approve(itemId: number): void {
  const items = load();
  for (const x of items) {
    if (x.id === itemId) {
      x.status = "approved";
      save(items);
      appendToAudit("queue_approve", { id: itemId, market_a: String(x.market_a ?? "").slice(0, 80) });
      return;
    }
  }
  save(items);
}

export function reject(itemId: number): void {
  const items = load();
  for (const x of items) {
    if (x.id === itemId) {
      x.status = "rejected";
      save(items);
      appendToAudit("queue_reject", { id: itemId, market_a: String(x.market_a ?? "").slice(0, 80) });
      return;
    }
  }
  save(items);
}

/** Onaylanmış/reddedilmiş kaydı tekrar bekleyene (pending) alır; yeniden Onayla/Reddet yapılabilir. */
export function reopen(itemId: number): void {
  const items = load();
  for (const x of items) {
    if (x.id === itemId) {
      x.status = "pending";
      save(items);
      appendToAudit("queue_reopen", { id: itemId, market_a: String(x.market_a ?? "").slice(0, 80) });
      return;
    }
  }
  save(items);
}
