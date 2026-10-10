CREATE TABLE `users` (
  `id` text PRIMARY KEY NOT NULL,
  `email` text NOT NULL,
  `name` text NOT NULL,
  `provider` text NOT NULL,
  `provider_account_id` text NOT NULL,
  `created_at` integer NOT NULL,
  `last_seen_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_provider_account` ON `users` (`provider`,`provider_account_id`);
--> statement-breakpoint
CREATE TABLE `sessions` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `expires_at` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE TABLE `analyses` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `mode` text NOT NULL,
  `source` text NOT NULL,
  `insight_title` text NOT NULL,
  `insight_body` text NOT NULL,
  `notes_json` text NOT NULL,
  `tasks_json` text NOT NULL,
  `total_minutes` integer NOT NULL,
  `before_score` integer NOT NULL,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE TABLE `resets` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `mode` text NOT NULL,
  `minutes` integer NOT NULL,
  `score` integer NOT NULL,
  `day` text NOT NULL,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
);
