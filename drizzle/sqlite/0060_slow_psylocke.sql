CREATE TABLE `wandofi_dataforseo_calls` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`path` text NOT NULL,
	`cost_usd` real NOT NULL,
	`project_id` text,
	`organization_id` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `wandofi_dataforseo_calls_created_at_idx` ON `wandofi_dataforseo_calls` (`created_at`);--> statement-breakpoint
CREATE INDEX `wandofi_dataforseo_calls_project_created_idx` ON `wandofi_dataforseo_calls` (`project_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `wandofi_project_spend_caps` (
	`project_id` text PRIMARY KEY NOT NULL,
	`monthly_cap_usd` real NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
