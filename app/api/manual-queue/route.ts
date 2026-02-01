import { NextRequest, NextResponse } from "next/server";
import * as queue from "../../../src/manual-review-queue.js";
import { getMode } from "../../../src/execution-mode.js";
import { executeQueueItem } from "../../../src/order-execution.js";

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
      const result = await executeQueueItem(id, "manual");
      if (!result.ok) {
        const status = result.reason?.includes("bulunamadı") ? 404 : 400;
        return NextResponse.json({ error: result.reason }, { status });
      }
      const mode = getMode();
      return NextResponse.json({
        ok: true,
        action: "approve",
        executed: mode.EXECUTION_MODE === "live",
        success: result.success,
        message: result.message,
        execution_mode: mode.EXECUTION_MODE,
      });
    }
    return NextResponse.json({ error: "action ve id gerekli" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
