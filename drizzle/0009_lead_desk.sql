CREATE TABLE `lead_audio` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer NOT NULL,
	`mime` text DEFAULT 'audio/webm' NOT NULL,
	`data` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `lead_events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `lead_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`lead_id` integer NOT NULL,
	`kind` text NOT NULL,
	`direction` text DEFAULT '' NOT NULL,
	`outcome` text DEFAULT '' NOT NULL,
	`text` text DEFAULT '' NOT NULL,
	`duration_sec` integer,
	`by` text DEFAULT '' NOT NULL,
	`at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `leads` ADD `temperature` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `leads` ADD `next_kind` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `leads` ADD `next_note` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `leads` ADD `next_at` integer;--> statement-breakpoint
ALTER TABLE `leads` ADD `last_contact_at` integer;--> statement-breakpoint
ALTER TABLE `leads` ADD `lost_reason` text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE `leads` SET `status` = 'contacted' WHERE `status` = 'qualified';--> statement-breakpoint
UPDATE `leads` SET `status` = 'lost' WHERE `status` = 'closed';--> statement-breakpoint
CREATE INDEX `lead_events_lead` ON `lead_events` (`lead_id`);
