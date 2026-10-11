import { NextResponse } from "next/server";
import { planFromAi } from "../../lib/ai-plan.mjs";
import { accountFromRequest, saveAnalysis } from "../../lib/accounts";
import { isMode } from "../../lib/vision";

export async function POST(request: Request) {
  const account = await accountFromRequest(request).catch(() => null);
  if (!account) return NextResponse.json({ error: "sign_in_required" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { mode?: unknown; plan?: unknown } | null;
  if (!body || !isMode(body.mode)) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  try {
    const plan = planFromAi(body.plan, body.mode);
    await saveAnalysis(account.id, body.mode, "device", plan);
    return NextResponse.json({ plan, source: "device" });
  } catch (error) {
    if (error instanceof Error && error.message === "limit") {
      return NextResponse.json({ error: "limit" }, { status: 429 });
    }
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
}
