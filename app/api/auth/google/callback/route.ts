import { NextResponse } from "next/server";
import { clearOauthStateCookie, openSession, readOauthState, sessionCookie, upsertUser } from "../../../../lib/accounts";
import { googleIdentity } from "../../../../lib/oauth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const returnTo = readOauthState(request, url.searchParams.get("state")) ?? "/";
  try {
    const identity = await googleIdentity(url.origin, url.searchParams.get("code") ?? "");
    const token = await openSession(await upsertUser(identity));
    const response = NextResponse.redirect(new URL(returnTo, url));
    response.headers.append("set-cookie", sessionCookie(token, request));
    response.headers.append("set-cookie", clearOauthStateCookie(request));
    return response;
  } catch {
    const response = NextResponse.redirect(new URL("/?auth_error=google_failed", url));
    response.headers.append("set-cookie", clearOauthStateCookie(request));
    return response;
  }
}
