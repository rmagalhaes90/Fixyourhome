import { NextResponse } from "next/server";
import { accountFromRequest, saveAnalysis } from "../../lib/accounts";
import { analyzeWithAi, isMode } from "../../lib/vision";

export async function POST(request: Request) {
  const account = await accountFromRequest(request).catch(() => null);
  if (!account) return NextResponse.json({ error: "sign_in_required" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { image?: unknown; mode?: unknown } | null;
  if (!body || !isMode(body.mode) || typeof body.image !== "string") {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  try {
    const plan = await analyzeWithAi(body.image, body.mode);
    await saveAnalysis(account.id, body.mode, "ai", plan);
    return NextResponse.json({ plan, source: "ai" });
  } catch (error) {
    if (error instanceof Error && error.message === "limit") {
      return NextResponse.json({ error: "limit" }, { status: 429 });
    }
    return NextResponse.json({ error: "ai_unavailable" }, { status: 503 });
  }
}
