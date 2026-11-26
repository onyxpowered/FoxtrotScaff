CREATE TABLE `Bans` (
	`Fingerprint` text PRIMARY KEY NOT NULL,
	`Reason` text NOT NULL,
	`ExpiresAt` integer,
	`CreatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `Hidden` (
	`UserId` text NOT NULL,
	`Tag` text NOT NULL,
	`CreatedAt` integer NOT NULL,
	PRIMARY KEY(`UserId`, `Tag`),
	FOREIGN KEY (`UserId`) REFERENCES `Users`(`Id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `HiddenTag` ON `Hidden` (`Tag`);--> statement-breakpoint
CREATE TABLE `Uploads` (
	`Id` text PRIMARY KEY NOT NULL,
	`UserId` text NOT NULL,
	`Hash` text NOT NULL,
	`Size` integer NOT NULL,
	`CreatedAt` integer NOT NULL,
	FOREIGN KEY (`UserId`) REFERENCES `Users`(`Id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `UploadsUser` ON `Uploads` (`UserId`,`CreatedAt`);--> statement-breakpoint
ALTER TABLE `Blobs` ADD `Kind` text DEFAULT 'file' NOT NULL;--> statement-breakpoint
ALTER TABLE `Blobs` ADD `Ext` text;--> statement-breakpoint
ALTER TABLE `Media` ADD `Name` text;--> statement-breakpoint
ALTER TABLE `Posts` ADD `ReplyGate` text DEFAULT 'everyone' NOT NULL;--> statement-breakpoint
ALTER TABLE `Reports` ADD `Category` text DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE `Users` ADD `PledgedAt` integer;