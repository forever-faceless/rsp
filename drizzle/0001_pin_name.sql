ALTER TABLE `surveys` ADD `pin_label` text DEFAULT '' NOT NULL;--> statement-breakpoint
-- A listing's location is now the pin of its survey. Bring every listing that has a
-- surveyed pin into line with it once; from here on the app keeps them in step.
UPDATE `properties` SET
  `lat` = (SELECT s.`lat` FROM `surveys` s WHERE s.`property_id` = `properties`.`id` AND s.`lat` IS NOT NULL AND s.`lng` IS NOT NULL ORDER BY s.`updated_at` DESC, s.`id` DESC LIMIT 1),
  `lng` = (SELECT s.`lng` FROM `surveys` s WHERE s.`property_id` = `properties`.`id` AND s.`lat` IS NOT NULL AND s.`lng` IS NOT NULL ORDER BY s.`updated_at` DESC, s.`id` DESC LIMIT 1)
WHERE EXISTS (SELECT 1 FROM `surveys` s WHERE s.`property_id` = `properties`.`id` AND s.`lat` IS NOT NULL AND s.`lng` IS NOT NULL);--> statement-breakpoint
UPDATE `sites` SET
  `lat` = (SELECT s.`lat` FROM `surveys` s WHERE s.`site_id` = `sites`.`id` AND s.`lat` IS NOT NULL AND s.`lng` IS NOT NULL ORDER BY s.`updated_at` DESC, s.`id` DESC LIMIT 1),
  `lng` = (SELECT s.`lng` FROM `surveys` s WHERE s.`site_id` = `sites`.`id` AND s.`lat` IS NOT NULL AND s.`lng` IS NOT NULL ORDER BY s.`updated_at` DESC, s.`id` DESC LIMIT 1)
WHERE EXISTS (SELECT 1 FROM `surveys` s WHERE s.`site_id` = `sites`.`id` AND s.`lat` IS NOT NULL AND s.`lng` IS NOT NULL);--> statement-breakpoint
UPDATE `projects` SET
  `lat` = (SELECT s.`lat` FROM `surveys` s WHERE s.`project_id` = `projects`.`id` AND s.`lat` IS NOT NULL AND s.`lng` IS NOT NULL ORDER BY s.`updated_at` DESC, s.`id` DESC LIMIT 1),
  `lng` = (SELECT s.`lng` FROM `surveys` s WHERE s.`project_id` = `projects`.`id` AND s.`lat` IS NOT NULL AND s.`lng` IS NOT NULL ORDER BY s.`updated_at` DESC, s.`id` DESC LIMIT 1)
WHERE EXISTS (SELECT 1 FROM `surveys` s WHERE s.`project_id` = `projects`.`id` AND s.`lat` IS NOT NULL AND s.`lng` IS NOT NULL);
