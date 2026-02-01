/**
 * Ortak kuyruk emir çalıştırma: Layer 3 doğrulama + submitOrders.
 * Hem manuel onay (API) hem otomatik tetikleyici (pipeline) kullanır.
 */
import * as queue from "./manual-review-queue.js";
import { loadYaml, loadEnv } from "./config.js";
import { getMode } from "./execution-mode.js";
import { passesExecutionValidation } from "./execution-validation.js";
import { submitOrders } from "./order-submission.js";
import { recordExecution } from "./monitoring.js";
import { appendToAudit } from "./audit-log.js";

export interface ExecuteResult {
  ok: boolean;
  reason?: string;
  success?: boolean;
  message?: string;
}

export async function executeQueueItem(id: number, source: "manual" | "auto" = "manual"): Promise<ExecuteResult> {
  const items = queue.getAll();
  const item = items.find((x) => x.id === id);
  if (!item || item.status !== "pending") {
    return { ok: false, reason: "Kayıt bulunamadı veya zaten işlendi" };
  }
  const risk = loadYaml("risk_params") as Record<string, unknown>;
  const minMarginUsd = Number(risk?.min_profit_margin_usd ?? 0.05);
  const minLiquidityUsd = Number(risk?.min_liquidity_per_leg_usd ?? 100);
  const refSizeUsd = Number(risk?.ref_size_usd ?? 100);
  const profitUsd = (1 - Number(item.min_cost ?? 0)) * refSizeUsd;
  const layer3 = passesExecutionValidation(profitUsd, minLiquidityUsd, minMarginUsd, minLiquidityUsd);
  if (!layer3.passed) {
    appendToAudit(source === "auto" ? "auto_trigger_layer3_fail" : "queue_approve_layer3_fail", { id, reason: layer3.reason });
    return { ok: false, reason: layer3.reason };
  }
  const tokenA = item.market_a_id != null ? String(item.market_a_id) : "";
  const tokenB = item.market_b_id != null ? String(item.market_b_id) : "";
  if (!tokenA.trim() || !tokenB.trim()) {
    return { ok: false, reason: "Market token ID eksik (market_a_id veya market_b_id)" };
  }
  const mode = getMode();
  const env = { ...process.env, ...loadEnv() } as Record<string, string>;
  env.EXECUTION_MODE = mode.EXECUTION_MODE;
  env.DRY_RUN = mode.DRY_RUN ? "true" : "false";
  const legs = [
    { token_id: tokenA, price: 0.5, side: "BUY" as const },
    { token_id: tokenB, price: 0.5, side: "BUY" as const },
  ];
  const sizeUsd = 1;
  const res = await submitOrders(legs, sizeUsd, env, risk, mode.EXECUTION_MODE);
  const profitUsd1 = (1 - Number(item.min_cost ?? 0)) * sizeUsd;
  recordExecution(res.success, res.success ? profitUsd1 : 0, 0);
  queue.approve(id);
  appendToAudit(source === "auto" ? "auto_trigger_exec" : "queue_approve_exec", {
    id,
    success: res.success,
    mode: mode.EXECUTION_MODE,
    message: res.message,
    source,
  });
  return { ok: true, success: res.success, message: res.message };
}
