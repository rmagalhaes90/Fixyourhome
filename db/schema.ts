import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    createdAt: integer("created_at").notNull(),
    lastSeenAt: integer("last_seen_at").notNull(),
  },
  (table) => [uniqueIndex("users_provider_account").on(table.provider, table.providerAccountId)],
);

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  expiresAt: integer("expires_at").notNull(),
});

export const analyses = sqliteTable("analyses", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  mode: text("mode").notNull(),
  source: text("source").notNull(),
  insightTitle: text("insight_title").notNull(),
  insightBody: text("insight_body").notNull(),
  notesJson: text("notes_json").notNull(),
  tasksJson: text("tasks_json").notNull(),
  totalMinutes: integer("total_minutes").notNull(),
  beforeScore: integer("before_score").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const resets = sqliteTable("resets", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  mode: text("mode").notNull(),
  minutes: integer("minutes").notNull(),
  score: integer("score").notNull(),
  day: text("day").notNull(),
  createdAt: integer("created_at").notNull(),
});
