CREATE TABLE `Attachments` (
	`Id` text PRIMARY KEY NOT NULL,
	`MessageId` text NOT NULL,
	`Hash` text NOT NULL,
	`Name` text,
	`Alt` text,
	`Position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`MessageId`) REFERENCES `Messages`(`Id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`Hash`) REFERENCES `Blobs`(`Hash`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `AttachmentsMessage` ON `Attachments` (`MessageId`,`Position`);--> statement-breakpoint
CREATE TABLE `Reactions` (
	`MessageId` text NOT NULL,
	`UserId` text NOT NULL,
	`Emoji` text NOT NULL,
	`CreatedAt` integer NOT NULL,
	PRIMARY KEY(`MessageId`, `UserId`, `Emoji`),
	FOREIGN KEY (`MessageId`) REFERENCES `Messages`(`Id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`UserId`) REFERENCES `Users`(`Id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `Messages` ADD `ReplyId` text REFERENCES Messages(Id) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `Messages` ADD `EditedAt` integer;--> statement-breakpoint
ALTER TABLE `Messages` ADD `DeletedAt` integer;--> statement-breakpoint
ALTER TABLE `Participants` ADD `ClearedId` text;--> statement-breakpoint
ALTER TABLE `Reports` ADD `Evidence` text;