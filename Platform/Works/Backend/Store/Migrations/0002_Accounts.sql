CREATE TABLE `Credentials` (
	`UserId` text PRIMARY KEY NOT NULL,
	`Hash` text NOT NULL,
	`CreatedAt` integer NOT NULL,
	FOREIGN KEY (`UserId`) REFERENCES `Users`(`Id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `Users` ADD `SuspendedAt` integer;