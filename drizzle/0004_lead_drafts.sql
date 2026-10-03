ALTER TABLE `leads` ADD `draft_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `leads` ADD `sent` integer DEFAULT true NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `leads_draft_key_unique` ON `leads` (`draft_key`) WHERE draft_key <> '';