import { NextResponse } from "next/server";
import { clearSessionCookie, closeSession } from "../../../lib/accounts";

export async function POST(request: Request) {
  try {
    await closeSession(request);
  } catch {
    // The cookie is cleared even when the database is unavailable.
  }
  const response = NextResponse.json({ ok: true });
  response.headers.append("set-cookie", clearSessionCookie(request));
  return response;
}
