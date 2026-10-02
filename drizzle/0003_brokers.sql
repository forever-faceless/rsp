CREATE TABLE `brokers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`firm` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `properties` ADD `source` text DEFAULT 'seller' NOT NULL;--> statement-breakpoint
ALTER TABLE `properties` ADD `broker_id` integer REFERENCES brokers(id);--> statement-breakpoint
ALTER TABLE `properties` ADD `deal_terms` text DEFAULT '' NOT NULL;