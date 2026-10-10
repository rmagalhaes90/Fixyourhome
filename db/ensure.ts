import { env } from "cloudflare:workers";

let ready: Promise<void> | null = null;

const statements = [
  `CREATE TABLE IF NOT EXISTS users (
    id text PRIMARY KEY,
    email text NOT NULL,
    name text NOT NULL,
    provider text NOT NULL,
    provider_account_id text NOT NULL,
    created_at integer NOT NULL,
    last_seen_at integer NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS users_provider_account ON users(provider, provider_account_id)`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id text PRIMARY KEY,
    user_id text NOT NULL REFERENCES users(id),
    expires_at integer NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS analyses (
    id text PRIMARY KEY,
    user_id text NOT NULL REFERENCES users(id),
    mode text NOT NULL,
    source text NOT NULL,
    insight_title text NOT NULL,
    insight_body text NOT NULL,
    notes_json text NOT NULL,
    tasks_json text NOT NULL,
    total_minutes integer NOT NULL,
    before_score integer NOT NULL,
    created_at integer NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS resets (
    id text PRIMARY KEY,
    user_id text NOT NULL REFERENCES users(id),
    mode text NOT NULL,
    minutes integer NOT NULL,
    score integer NOT NULL,
    day text NOT NULL,
    created_at integer NOT NULL
  )`,
];

export function ensureSchema() {
  ready ??= (async () => {
    if (!env.DB) {
      throw new Error("Cloudflare D1 binding `DB` is unavailable.");
    }
    for (const statement of statements) {
      await env.DB.prepare(statement).run();
    }
  })();
  return ready;
}
