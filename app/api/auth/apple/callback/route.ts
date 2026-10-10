import { NextResponse } from "next/server";
import { clearOauthStateCookie, openSession, readOauthState, sessionCookie, upsertUser } from "../../../../lib/accounts";
import { appleIdentity } from "../../../../lib/oauth";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const form = await request.formData();
  const returnTo = readOauthState(request, String(form.get("state") ?? "")) ?? "/";
  try {
    const identity = await appleIdentity(url.origin, String(form.get("code") ?? ""), form.get("user") ? String(form.get("user")) : null);
    const token = await openSession(await upsertUser(identity));
    const response = NextResponse.redirect(new URL(returnTo, url), 303);
    response.headers.append("set-cookie", sessionCookie(token, request));
    response.headers.append("set-cookie", clearOauthStateCookie(request));
    return response;
  } catch {
    const response = NextResponse.redirect(new URL("/?auth_error=apple_failed", url), 303);
    response.headers.append("set-cookie", clearOauthStateCookie(request));
    return response;
  }
}
