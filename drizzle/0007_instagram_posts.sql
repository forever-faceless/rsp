CREATE TABLE `ig_posts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`file_url` text DEFAULT '' NOT NULL,
	`caption` text DEFAULT '' NOT NULL,
	`scheduled_at` integer NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`ref` text DEFAULT '' NOT NULL,
	`project_id` integer,
	`site_id` integer,
	`property_id` integer,
	`container_id` text DEFAULT '' NOT NULL,
	`started_at` integer,
	`tries` integer DEFAULT 0 NOT NULL,
	`media_id` text DEFAULT '' NOT NULL,
	`permalink` text DEFAULT '' NOT NULL,
	`published_at` integer,
	`error` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
ALTER TABLE `ig_settings` ADD `last_cron_at` integer;