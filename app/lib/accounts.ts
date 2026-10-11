import { env } from "cloudflare:workers";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../db";
import { ensureSchema } from "../../db/ensure";
import { analyses, resets, sessions, users } from "../../db/schema";
import { streakFromDays } from "./ai-plan.mjs";

const SESSION_COOKIE = "tidynext_session";
const STATE_COOKIE = "tidynext_oauth";
const SESSION_SECONDS = 60 * 60 * 24 * 30;

type Provider = "google" | "apple";

export type AccountProfile = {
  id: string;
  email: string;
  name: string;
  provider: string;
  createdAt: number;
  streak: number;
  minutes: number;
  resets: number;
  analyses: number;
  lastScore: number | null;
  lastDay: string | null;
};

type Identity = {
  provider: Provider;
  providerAccountId: string;
  email: string;
  name: string;
};

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

export function requestIsSecure(request: Request) {
  return new URL(request.url).protocol === "https:";
}

export function readCookie(request: Request, name: string) {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function cookieHeader(name: string, value: string, maxAge: number, secure: boolean) {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAge}`];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function upsertUser(identity: Identity) {
  await ensureSchema();
  const db = getDb();
  const now = nowSeconds();
  const existing = await db
    .select()
    .from(users)
    .where(and(eq(users.provider, identity.provider), eq(users.providerAccountId, identity.providerAccountId)))
    .limit(1);
  if (existing[0]) {
    await db
      .update(users)
      .set({ email: identity.email, name: identity.name, lastSeenAt: now })
      .where(eq(users.id, existing[0].id));
    return existing[0].id;
  }
  const id = crypto.randomUUID();
  await db.insert(users).values({
    id,
    email: identity.email,
    name: identity.name,
    provider: identity.provider,
    providerAccountId: identity.providerAccountId,
    createdAt: now,
    lastSeenAt: now,
  });
  return id;
}

export async function openSession(userId: string) {
  await ensureSchema();
  const token = randomToken();
  const id = await sha256(token);
  await getDb().insert(sessions).values({
    id,
    userId,
    expiresAt: nowSeconds() + SESSION_SECONDS,
  });
  return token;
}

async function profileFor(userId: string): Promise<AccountProfile | null> {
  const db = getDb();
  const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = userRows[0];
  if (!user) return null;
  const resetRows = await db.select().from(resets).where(eq(resets.userId, userId)).orderBy(desc(resets.createdAt));
  const analysisRows = await db.select({ id: analyses.id }).from(analyses).where(eq(analyses.userId, userId));
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    provider: user.provider,
    createdAt: user.createdAt,
    streak: streakFromDays(resetRows.map((row) => row.day), today),
    minutes: resetRows.reduce((sum, row) => sum + row.minutes, 0),
    resets: resetRows.length,
    analyses: analysisRows.length,
    lastScore: resetRows[0]?.score ?? null,
    lastDay: resetRows[0]?.day ?? null,
  };
}

export async function accountFromRequest(request: Request) {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;
  await ensureSchema();
  const id = await sha256(token);
  const db = getDb();
  const sessionRows = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
  const session = sessionRows[0];
  if (!session || session.expiresAt < nowSeconds()) return null;
  return profileFor(session.userId);
}

export async function closeSession(request: Request) {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return;
  await ensureSchema();
  const id = await sha256(token);
  await getDb().delete(sessions).where(eq(sessions.id, id));
}

export function sessionCookie(token: string, request: Request) {
  return cookieHeader(SESSION_COOKIE, token, SESSION_SECONDS, requestIsSecure(request));
}

export function clearSessionCookie(request: Request) {
  return cookieHeader(SESSION_COOKIE, "", 0, requestIsSecure(request));
}

export async function rememberOauthState(returnTo: string) {
  const nonce = randomToken();
  return { nonce, value: `${nonce}.${returnTo}` };
}

export function oauthStateCookie(value: string, request: Request) {
  return cookieHeader(STATE_COOKIE, value, 600, requestIsSecure(request));
}

export function clearOauthStateCookie(request: Request) {
  return cookieHeader(STATE_COOKIE, "", 0, requestIsSecure(request));
}

export function readOauthState(request: Request, state: string | null) {
  const stored = readCookie(request, STATE_COOKIE);
  if (!stored || !state) return null;
  const splitAt = stored.indexOf(".");
  if (splitAt < 0) return null;
  const nonce = stored.slice(0, splitAt);
  const returnTo = stored.slice(splitAt + 1);
  if (nonce !== state || !returnTo.startsWith("/") || returnTo.startsWith("//")) return null;
  return returnTo;
}

export async function saveAnalysis(userId: string, mode: string, source: "ai" | "device", plan: {
  insightTitle: string;
  insightBody: string;
  notes: string[];
  tasks: unknown[];
  totalMinutes: number;
  beforeScore: number;
}) {
  await ensureSchema();
  const db = getDb();
  const hourAgo = nowSeconds() - 3600;
  const recent = await db.select({ id: analyses.id, createdAt: analyses.createdAt }).from(analyses).where(eq(analyses.userId, userId));
  if (recent.filter((row) => row.createdAt >= hourAgo).length >= 20) {
    throw new Error("limit");
  }
  await db.insert(analyses).values({
    id: crypto.randomUUID(),
    userId,
    mode,
    source,
    insightTitle: plan.insightTitle,
    insightBody: plan.insightBody,
    notesJson: JSON.stringify(plan.notes),
    tasksJson: JSON.stringify(plan.tasks),
    totalMinutes: plan.totalMinutes,
    beforeScore: plan.beforeScore,
    createdAt: nowSeconds(),
  });
}

export async function saveReset(userId: string, input: { mode: string; minutes: number; score: number; day: string }) {
  await ensureSchema();
  await getDb().insert(resets).values({
    id: crypto.randomUUID(),
    userId,
    mode: input.mode,
    minutes: input.minutes,
    score: input.score,
    day: input.day,
    createdAt: nowSeconds(),
  });
}

type SecretName = "OPENAI_API_KEY" | "OPENAI_MODEL" | "GOOGLE_CLIENT_ID" | "GOOGLE_CLIENT_SECRET" | "APPLE_CLIENT_ID" | "APPLE_TEAM_ID" | "APPLE_KEY_ID" | "APPLE_PRIVATE_KEY";

export function secret(name: SecretName) {
  const value = (env as unknown as Record<string, string | undefined>)[name];
  return value && value.trim() ? value.trim() : null;
}
