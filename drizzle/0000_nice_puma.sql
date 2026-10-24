CREATE TABLE `applications` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`candidate_id` text NOT NULL,
	`snapshot` text NOT NULL,
	`job_version` integer NOT NULL,
	`status` text DEFAULT 'submitted' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `application_candidate_job` ON `applications` (`job_id`,`candidate_id`);--> statement-breakpoint
CREATE INDEX `application_candidate_idx` ON `applications` (`candidate_id`);--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`title` text NOT NULL,
	`company` text NOT NULL,
	`location` text NOT NULL,
	`category` text NOT NULL,
	`type` text NOT NULL,
	`salary_min` integer,
	`salary_max` integer,
	`description` text NOT NULL,
	`requirements` text NOT NULL,
	`shift` text NOT NULL,
	`deadline` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`embedding` text,
	`embedding_model` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `jobs_owner_idx` ON `jobs` (`owner_id`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`location` text NOT NULL,
	`target_role` text NOT NULL,
	`language` text NOT NULL,
	`experience` text NOT NULL,
	`skills` text NOT NULL,
	`availability` text NOT NULL,
	`updated_at` text NOT NULL
);
