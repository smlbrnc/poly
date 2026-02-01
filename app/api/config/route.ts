import { NextRequest, NextResponse } from "next/server";
import { loadYaml, saveRiskParams, saveMonitoringAlerts } from "../../../src/config";

function auth(req: Request): boolean {
  const secret = process.env.WEB_ADMIN_SECRET;
  if (!secret) return true;
  const header = req.headers.get("x-admin-secret") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return header === secret;
}

export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const name = req.nextUrl.searchParams.get("name") ?? "risk_params";
    const data = loadYaml(name);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    if (body.risk_params) saveRiskParams(body.risk_params);
    if (body.monitoring_alerts) saveMonitoringAlerts(body.monitoring_alerts);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
