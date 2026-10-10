import { secret } from "./accounts";

function base64Url(bytes: Uint8Array) {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlJson(value: unknown) {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}

export function googleConfigured() {
  return Boolean(secret("GOOGLE_CLIENT_ID") && secret("GOOGLE_CLIENT_SECRET"));
}

export function appleConfigured() {
  return Boolean(secret("APPLE_CLIENT_ID") && secret("APPLE_TEAM_ID") && secret("APPLE_KEY_ID") && secret("APPLE_PRIVATE_KEY"));
}

export function googleStartUrl(origin: string, state: string) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", secret("GOOGLE_CLIENT_ID") ?? "");
  url.searchParams.set("redirect_uri", `${origin}/api/auth/google/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  return url;
}

export async function googleIdentity(origin: string, code: string) {
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: secret("GOOGLE_CLIENT_ID") ?? "",
      client_secret: secret("GOOGLE_CLIENT_SECRET") ?? "",
      redirect_uri: `${origin}/api/auth/google/callback`,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenResponse.ok) throw new Error("google_token");
  const token = (await tokenResponse.json()) as { access_token?: string };
  if (!token.access_token) throw new Error("google_token");
  const profileResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { authorization: `Bearer ${token.access_token}` },
  });
  if (!profileResponse.ok) throw new Error("google_profile");
  const profile = (await profileResponse.json()) as { sub?: string; email?: string; email_verified?: boolean; name?: string };
  if (!profile.sub || !profile.email || profile.email_verified === false) throw new Error("google_profile");
  return {
    provider: "google" as const,
    providerAccountId: profile.sub,
    email: profile.email,
    name: profile.name?.trim() || profile.email,
  };
}

async function appleClientSecret() {
  const pem = (secret("APPLE_PRIVATE_KEY") ?? "").replaceAll("\\n", "\n");
  const body = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const raw = Uint8Array.from(atob(body), (char) => char.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", raw, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const header = base64UrlJson({ alg: "ES256", kid: secret("APPLE_KEY_ID") });
  const issued = Math.floor(Date.now() / 1000);
  const payload = base64UrlJson({
    iss: secret("APPLE_TEAM_ID"),
    iat: issued,
    exp: issued + 60 * 10,
    aud: "https://appleid.apple.com",
    sub: secret("APPLE_CLIENT_ID"),
  });
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(`${header}.${payload}`));
  return `${header}.${payload}.${base64Url(new Uint8Array(signature))}`;
}

export function appleStartUrl(origin: string, state: string) {
  const url = new URL("https://appleid.apple.com/auth/authorize");
  url.searchParams.set("client_id", secret("APPLE_CLIENT_ID") ?? "");
  url.searchParams.set("redirect_uri", `${origin}/api/auth/apple/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("response_mode", "form_post");
  url.searchParams.set("scope", "name email");
  url.searchParams.set("state", state);
  return url;
}

function decodeJwtPayload(token: string) {
  const segment = token.split(".")[1] ?? "";
  const padded = segment.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - (segment.length % 4)) % 4);
  return JSON.parse(atob(padded)) as { sub?: string; email?: string };
}

export async function appleIdentity(origin: string, code: string, userField: string | null) {
  const tokenResponse = await fetch("https://appleid.apple.com/auth/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: secret("APPLE_CLIENT_ID") ?? "",
      client_secret: await appleClientSecret(),
      code,
      grant_type: "authorization_code",
      redirect_uri: `${origin}/api/auth/apple/callback`,
    }),
  });
  if (!tokenResponse.ok) throw new Error("apple_token");
  const token = (await tokenResponse.json()) as { id_token?: string };
  if (!token.id_token) throw new Error("apple_token");
  const payload = decodeJwtPayload(token.id_token);
  if (!payload.sub) throw new Error("apple_profile");
  let name = "Conta Apple";
  if (userField) {
    try {
      const appleUser = JSON.parse(userField) as { name?: { firstName?: string; lastName?: string }; email?: string };
      const joined = [appleUser.name?.firstName, appleUser.name?.lastName].filter(Boolean).join(" ").trim();
      if (joined) name = joined;
      if (!payload.email && appleUser.email) payload.email = appleUser.email;
    } catch {
      name = "Conta Apple";
    }
  }
  return {
    provider: "apple" as const,
    providerAccountId: payload.sub,
    email: payload.email || `${payload.sub}@privaterelay.appleid.com`,
    name,
  };
}
