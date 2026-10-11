import { NextResponse } from "next/server";
import { accountFromRequest, saveReset } from "../../lib/accounts";
import { isMode } from "../../lib/vision";

export async function POST(request: Request) {
  const account = await accountFromRequest(request).catch(() => null);
  if (!account) return NextResponse.json({ error: "sign_in_required" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { mode?: unknown; minutes?: unknown; score?: unknown; day?: unknown } | null;
  const minutes = Number(body?.minutes);
  const score = Number(body?.score);
  const day = String(body?.day ?? "");
  if (!body || !isMode(body.mode) || !Number.isFinite(minutes) || minutes < 1 || minutes > 180 || !Number.isFinite(score) || score < 0 || score > 100 || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  try {
    await saveReset(account.id, { mode: body.mode, minutes: Math.round(minutes), score: Math.round(score), day });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
