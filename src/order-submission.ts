/**
 * Emir gönderimi: paper modda log, live modda CLOB client.
 */
import { placeOrderStub } from "./clob-client.js";

export function submitOrdersPaper(legs: unknown[], sizeUsd: number, reason = "paper"): { success: boolean; message: string } {
  return { success: true, message: `paper:${reason} legs=${legs.length} size_usd=${sizeUsd}` };
}

/** Paralel bacak gönderimi. */
export async function submitOrdersLive(
  legs: Array<{ token_id?: string; price?: number; side?: string }>,
  sizeUsd: number,
  env: Record<string, string>
): Promise<{ success: boolean; message: string }> {
  if (!legs.length) return { success: false, message: "Bacak yok" };
  const results = await Promise.all(
    legs.map((leg) => {
      const tokenId = leg.token_id ?? "stub";
      const price = leg.price ?? 0.5;
      const side = (leg.side === "SELL" ? "SELL" : "BUY") as "BUY" | "SELL";
      return placeOrderStub(env, tokenId, price, sizeUsd, side);
    })
  );
  const successAll = results.every((r) => r.success);
  const errMsg = results.find((r) => !r.success)?.message;
  const msg = successAll
    ? `live legs=${legs.length} size_usd=${sizeUsd}`
    : errMsg ?? `live legs=${legs.length} size_usd=${sizeUsd}`;
  return { success: successAll, message: msg };
}

export async function submitOrders(
  legs: Array<{ token_id?: string; price?: number; side?: string }>,
  sizeUsd: number,
  env: Record<string, string>,
  _config: unknown,
  executionMode?: string
): Promise<{ success: boolean; message: string }> {
  const mode = executionMode ?? env.EXECUTION_MODE ?? "paper";
  const dryRun = (env.DRY_RUN ?? "true").toLowerCase() === "true";
  if (mode === "paper" || dryRun) return submitOrdersPaper(legs, sizeUsd);
  return submitOrdersLive(legs, sizeUsd, env);
}
