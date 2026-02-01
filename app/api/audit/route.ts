import { NextRequest, NextResponse } from "next/server";
import { readAuditLog, AUTO_LOG_ACTIONS, IS_VERCEL } from "../../../src/audit-log";

function auth(req: Request): boolean {
  const secret = process.env.WEB_ADMIN_SECRET;
  if (!secret) return true;
  const header = req.headers.get("x-admin-secret") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return header === secret;
}

export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "200", 10), 500);
    const action = req.nextUrl.searchParams.get("action") ?? undefined;
    const group = req.nextUrl.searchParams.get("group") ?? undefined;
    const actionSet = group === "auto" ? AUTO_LOG_ACTIONS : undefined;
    const data = readAuditLog(limit, action, actionSet);
    if (group === "auto" && IS_VERCEL) return NextResponse.json({ entries: data, isVercel: true });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
