/** GET /api/test-polymarket-auth → CLOB API key geçerliliği (getOpenOrders). */
import { NextResponse } from "next/server";
import { loadEnv } from "../../../src/config.js";
import { getClient } from "../../../src/clob-client.js";

export async function GET() {
  try {
    const env = loadEnv();
    const client = await getClient(env);
    if (!client)
      return NextResponse.json({ ok: false, error: "API credential eksik veya client oluşamadı." });
    await (client as { getOpenOrders: (p?: unknown, onlyFirst?: boolean) => Promise<unknown> }).getOpenOrders(undefined, true);
    return NextResponse.json({ ok: true, message: "API key geçerli." });
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string }; status?: number }; message?: string };
    const apiErr = err.response?.data?.error;
    const status = err.response?.status;
    const msg = apiErr ?? (e instanceof Error ? e.message : String(e));
    return NextResponse.json({
      ok: false,
      error: msg,
      status: status ?? null,
    });
  }
}
