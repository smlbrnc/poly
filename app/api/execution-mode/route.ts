import { NextResponse } from "next/server";
import { getMode, setMode, type TriggerMode } from "../../../src/execution-mode.js";

function auth(req: Request): boolean {
  const secret = process.env.WEB_ADMIN_SECRET;
  if (!secret) return true;
  const header = req.headers.get("x-admin-secret") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return header === secret;
}

export async function GET(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const data = getMode();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const mode = body.EXECUTION_MODE ?? body.mode;
    const dryRun = body.DRY_RUN ?? body.dry_run;
    const triggerMode = (body.TRIGGER_MODE ?? body.trigger_mode) as TriggerMode | undefined;
    const data = setMode(mode !== undefined ? String(mode) : undefined, dryRun, triggerMode);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
