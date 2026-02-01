/**
 * İşlem modu: config/execution_mode.json (panelden değiştirilir).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { appendToAudit } from "./audit-log.js";

const ROOT = process.cwd();
const CONFIG_DIR = join(ROOT, "config");
const MODE_PATH = join(CONFIG_DIR, "execution_mode.json");
const IS_VERCEL = process.env.VERCEL === "1";

/** SOP §4.6.3: Otomatik = pipeline fırsatları otomatik execution'a gönderir; Manuel = sadece kuyruk, kullanıcı onayı ile. */
export type TriggerMode = "auto" | "manual";

export interface ModeData {
  EXECUTION_MODE: string;
  DRY_RUN: boolean;
  /** Otomatik: Layer 3 geçen fırsatlar otomatik execution. Manuel: sadece kuyruk, panelden onay. */
  TRIGGER_MODE: TriggerMode;
}

export function getMode(): ModeData {
  const defaultMode: ModeData = { EXECUTION_MODE: "paper", DRY_RUN: true, TRIGGER_MODE: "manual" };
  if (IS_VERCEL) {
    const ex = process.env.EXECUTION_MODE?.toLowerCase();
    const tr = process.env.TRIGGER_MODE?.toLowerCase();
    return {
      EXECUTION_MODE: ex === "live" ? "live" : "paper",
      DRY_RUN: ex !== "live",
      TRIGGER_MODE: (tr === "auto" ? "auto" : "manual") as TriggerMode,
    };
  }
  if (!existsSync(MODE_PATH)) return defaultMode;
  try {
    const data = JSON.parse(readFileSync(MODE_PATH, "utf-8")) as Partial<ModeData>;
    return {
      EXECUTION_MODE: data.EXECUTION_MODE ?? "paper",
      DRY_RUN: data.DRY_RUN ?? data.EXECUTION_MODE === "paper",
      TRIGGER_MODE: (data.TRIGGER_MODE === "auto" ? "auto" : "manual") as TriggerMode,
    };
  } catch {
    return defaultMode;
  }
}

export function setMode(executionMode?: string, dryRun?: boolean, triggerMode?: TriggerMode): ModeData {
  if (IS_VERCEL) {
    throw new Error(
      "Vercel'de execution mode dosyaya yazılamaz. EXECUTION_MODE ve TRIGGER_MODE env değişkenleri ile ayarlayın."
    );
  }
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
  const data = getMode();
  if (executionMode !== undefined) {
    data.EXECUTION_MODE = String(executionMode).toLowerCase();
    data.DRY_RUN = dryRun !== undefined ? Boolean(dryRun) : data.EXECUTION_MODE === "paper";
  }
  if (triggerMode !== undefined) data.TRIGGER_MODE = triggerMode === "auto" ? "auto" : "manual";
  writeFileSync(MODE_PATH, JSON.stringify(data, null, 2), "utf-8");
  appendToAudit("execution_mode_change", { mode: data.EXECUTION_MODE, dry_run: data.DRY_RUN, trigger: data.TRIGGER_MODE });
  return data;
}
