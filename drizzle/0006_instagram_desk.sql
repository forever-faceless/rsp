CREATE TABLE `ig_media` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`media_id` text NOT NULL,
	`kind` text DEFAULT 'reel' NOT NULL,
	`caption` text DEFAULT '' NOT NULL,
	`permalink` text DEFAULT '' NOT NULL,
	`thumbnail` text DEFAULT '' NOT NULL,
	`posted_at` integer,
	`ref` text DEFAULT '' NOT NULL,
	`project_id` integer,
	`site_id` integer,
	`property_id` integer,
	`comments_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ig_media_media_unique` ON `ig_media` (`media_id`);--> statement-breakpoint
CREATE TABLE `ig_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`thread_id` integer NOT NULL,
	`direction` text NOT NULL,
	`kind` text DEFAULT 'text' NOT NULL,
	`sender` text DEFAULT 'them' NOT NULL,
	`text` text DEFAULT '' NOT NULL,
	`mid` text DEFAULT '' NOT NULL,
	`media_id` text DEFAULT '' NOT NULL,
	`media_url` text DEFAULT '' NOT NULL,
	`media_title` text DEFAULT '' NOT NULL,
	`failed` text DEFAULT '' NOT NULL,
	`raw` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`thread_id`) REFERENCES `ig_threads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ig_messages_mid_unique` ON `ig_messages` (`mid`) WHERE mid <> '';--> statement-breakpoint
CREATE TABLE `ig_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`dm_auto` integer DEFAULT false NOT NULL,
	`comment_auto` integer DEFAULT false NOT NULL,
	`comment_all` integer DEFAULT false NOT NULL,
	`comment_words` text DEFAULT '' NOT NULL,
	`comment_since` integer,
	`link_locale` text DEFAULT 'kn' NOT NULL,
	`templates` text DEFAULT '{}' NOT NULL,
	`access_token` text DEFAULT '' NOT NULL,
	`token_expires_at` integer,
	`ig_user_id` text DEFAULT '' NOT NULL,
	`ig_username` text DEFAULT '' NOT NULL,
	`last_webhook_at` integer,
	`last_error` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ig_threads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ig_user_id` text NOT NULL,
	`username` text DEFAULT '' NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`state` text DEFAULT 'needs_you' NOT NULL,
	`topic` text DEFAULT 'other' NOT NULL,
	`ref` text DEFAULT '' NOT NULL,
	`project_id` integer,
	`site_id` integer,
	`property_id` integer,
	`lead_id` integer,
	`phone` text DEFAULT '' NOT NULL,
	`auto_paused` integer DEFAULT false NOT NULL,
	`unread` integer DEFAULT 0 NOT NULL,
	`last_inbound_at` integer,
	`last_message_at` integer DEFAULT (unixepoch()) NOT NULL,
	`last_text` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ig_threads_user_unique` ON `ig_threads` (`ig_user_id`);