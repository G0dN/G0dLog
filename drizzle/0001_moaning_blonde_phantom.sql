CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hash_unique` ON `sessions` (`token_hash`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_column_members` (
	`column_id` text NOT NULL,
	`user_id` text NOT NULL,
	`invited_by` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`joined_at` text NOT NULL,
	`removed_at` text,
	`removed_by` text,
	PRIMARY KEY(`column_id`, `user_id`),
	FOREIGN KEY (`column_id`) REFERENCES `columns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`invited_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`removed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_column_members`("column_id", "user_id", "invited_by", "status", "joined_at", "removed_at", "removed_by") SELECT "column_id", "user_id", "invited_by", 'active', "joined_at", NULL, NULL FROM `column_members`;--> statement-breakpoint
DROP TABLE `column_members`;--> statement-breakpoint
ALTER TABLE `__new_column_members` RENAME TO `column_members`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `users` ADD `password_changed_at` text;--> statement-breakpoint
ALTER TABLE `users` ADD `last_login_at` text;
