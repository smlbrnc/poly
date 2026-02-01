import { NextRequest, NextResponse } from "next/server";
import * as queue from "../../../src/manual-review-queue.js";
import { loadYaml, loadEnv } from "../../../src/config.js";
import { getMode } from "../../../src/execution-mode.js";
import { passesExecutionValidation } from "../../../src/execution-validation.js";
import { submitOrders } from "../../../src/order-submission.js";
import { recordExecution } from "../../../src/monitoring.js";
import { appendToAudit } from "../../../src/audit-log.js";

function auth(req: Request): boolean {
  const secret = process.env.WEB_ADMIN_SECRET;
  if (!secret) return true;
  const header = req.headers.get("x-admin-secret") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return header === secret;
}

export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const pending = req.nextUrl.searchParams.get("pending") === "true";
    const data = pending ? queue.getPending() : queue.getAll();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const action = body.action;
    const id = body.id ?? body.itemId;
    if (action === "reject" && typeof id === "number") {
      queue.reject(id);
      return NextResponse.json({ ok: true, action: "reject" });
    }
    if (action === "reopen" && typeof id === "number") {
      queue.reopen(id);
      return NextResponse.json({ ok: true, action: "reopen" });
    }
    if (action === "approve" && typeof id === "number") {
      const items = queue.getAll();
      const item = items.find((x) => x.id === id);
      if (!item || item.status !== "pending") {
        return NextResponse.json({ error: "Kayıt bulunamadı veya zaten işlendi" }, { status: 404 });
      }
      const risk = loadYaml("risk_params") as Record<string, unknown>;
      const minMarginUsd = Number(risk?.min_profit_margin_usd ?? 0.05);
      const minLiquidityUsd = Number(risk?.min_liquidity_per_leg_usd ?? 100);
      const refSizeUsd = Number(risk?.ref_size_usd ?? 100);
      const profitUsd = (1 - Number(item.min_cost ?? 0)) * refSizeUsd;
      const layer3 = passesExecutionValidation(profitUsd, minLiquidityUsd, minMarginUsd, minLiquidityUsd);
      if (!layer3.passed) {
        appendToAudit("queue_approve_layer3_fail", { id, reason: layer3.reason });
        return NextResponse.json({ ok: false, reason: layer3.reason }, { status: 400 });
      }
      const mode = getMode();
      const env = { ...process.env, ...loadEnv() } as Record<string, string>;
      env.EXECUTION_MODE = mode.EXECUTION_MODE;
      env.DRY_RUN = mode.DRY_RUN ? "true" : "false";
      const legs = [
        { token_id: String(item.market_a_id ?? ""), price: 0.5, side: "BUY" as const },
        { token_id: String(item.market_b_id ?? ""), price: 0.5, side: "BUY" as const },
      ];
      const sizeUsd = 1; // Manuel kuyruktan onayda sabit 1 USD işlem
      const res = await submitOrders(legs, sizeUsd, env, risk, mode.EXECUTION_MODE);
      const profitUsd1 = (1 - Number(item.min_cost ?? 0)) * sizeUsd;
      recordExecution(res.success, res.success ? profitUsd1 : 0, 0);
      queue.approve(id);
      appendToAudit("queue_approve_exec", { id, success: res.success, mode: mode.EXECUTION_MODE, message: res.message });
      return NextResponse.json({
        ok: true,
        action: "approve",
        executed: mode.EXECUTION_MODE === "live",
        success: res.success,
        message: res.message,
        execution_mode: mode.EXECUTION_MODE,
      });
    }
    return NextResponse.json({ error: "action ve id gerekli" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
