import { NextResponse } from "next/server";
import { oauthStateCookie, rememberOauthState } from "../../../lib/accounts";
import { googleConfigured, googleStartUrl } from "../../../lib/oauth";

function safeReturn(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (!googleConfigured()) {
    return NextResponse.redirect(new URL("/?auth_error=google_not_configured", url));
  }
  const state = await rememberOauthState(safeReturn(url.searchParams.get("return_to")));
  const response = NextResponse.redirect(googleStartUrl(url.origin, state.nonce));
  response.headers.append("set-cookie", oauthStateCookie(state.value, request));
  return response;
}
