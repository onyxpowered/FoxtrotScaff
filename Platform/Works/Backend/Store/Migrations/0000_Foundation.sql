CREATE TABLE `Blobs` (
	`Hash` text PRIMARY KEY NOT NULL,
	`Mime` text NOT NULL,
	`Size` integer NOT NULL,
	`Width` integer,
	`Height` integer,
	`CreatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `Blocks` (
	`UserId` text NOT NULL,
	`TargetId` text NOT NULL,
	`CreatedAt` integer NOT NULL,
	PRIMARY KEY(`UserId`, `TargetId`),
	FOREIGN KEY (`UserId`) REFERENCES `Users`(`Id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`TargetId`) REFERENCES `Users`(`Id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `Connections` (
	`Id` text PRIMARY KEY NOT NULL,
	`UserId` text NOT NULL,
	`Platform` text NOT NULL,
	`Handle` text NOT NULL,
	`Mode` text NOT NULL,
	`Secret` text,
	`Status` text DEFAULT 'active' NOT NULL,
	`CheckedAt` integer,
	`CreatedAt` integer NOT NULL,
	FOREIGN KEY (`UserId`) REFERENCES `Users`(`Id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ConnectionsAccount` ON `Connections` (`UserId`,`Platform`,`Handle`);--> statement-breakpoint
CREATE TABLE `Conversations` (
	`Id` text PRIMARY KEY NOT NULL,
	`CreatedAt` integer NOT NULL,
	`UpdatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `Crossposts` (
	`Id` text PRIMARY KEY NOT NULL,
	`PostId` text NOT NULL,
	`ConnectionId` text NOT NULL,
	`Status` text DEFAULT 'queued' NOT NULL,
	`RemoteId` text,
	`RemoteUrl` text,
	`Error` text,
	`CreatedAt` integer NOT NULL,
	`PostedAt` integer,
	FOREIGN KEY (`PostId`) REFERENCES `Posts`(`Id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ConnectionId`) REFERENCES `Connections`(`Id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `CrosspostsTarget` ON `Crossposts` (`PostId`,`ConnectionId`);--> statement-breakpoint
CREATE INDEX `CrosspostsStatus` ON `Crossposts` (`Status`);--> statement-breakpoint
CREATE TABLE `Faves` (
	`UserId` text NOT NULL,
	`PostId` text NOT NULL,
	`CreatedAt` integer NOT NULL,
	PRIMARY KEY(`UserId`, `PostId`),
	FOREIGN KEY (`UserId`) REFERENCES `Users`(`Id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`PostId`) REFERENCES `Posts`(`Id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `FavesPost` ON `Faves` (`PostId`);--> statement-breakpoint
CREATE TABLE `Follows` (
	`UserId` text NOT NULL,
	`TargetId` text NOT NULL,
	`CreatedAt` integer NOT NULL,
	PRIMARY KEY(`UserId`, `TargetId`),
	FOREIGN KEY (`UserId`) REFERENCES `Users`(`Id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`TargetId`) REFERENCES `Users`(`Id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `FollowsTarget` ON `Follows` (`TargetId`);--> statement-breakpoint
CREATE TABLE `Invites` (
	`Id` text PRIMARY KEY NOT NULL,
	`CreatorId` text,
	`Code` text NOT NULL,
	`UsedBy` text,
	`UsedAt` integer,
	`CreatedAt` integer NOT NULL,
	FOREIGN KEY (`CreatorId`) REFERENCES `Users`(`Id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`UsedBy`) REFERENCES `Users`(`Id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Invites_Code_unique` ON `Invites` (`Code`);--> statement-breakpoint
CREATE TABLE `Media` (
	`Id` text PRIMARY KEY NOT NULL,
	`PostId` text NOT NULL,
	`Hash` text NOT NULL,
	`Kind` text NOT NULL,
	`Alt` text,
	`Position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`PostId`) REFERENCES `Posts`(`Id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`Hash`) REFERENCES `Blobs`(`Hash`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `MediaPost` ON `Media` (`PostId`,`Position`);--> statement-breakpoint
CREATE INDEX `MediaHash` ON `Media` (`Hash`);--> statement-breakpoint
CREATE TABLE `Messages` (
	`Id` text PRIMARY KEY NOT NULL,
	`ConversationId` text NOT NULL,
	`SenderId` text,
	`Body` text NOT NULL,
	`CreatedAt` integer NOT NULL,
	FOREIGN KEY (`ConversationId`) REFERENCES `Conversations`(`Id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`SenderId`) REFERENCES `Users`(`Id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `MessagesConversation` ON `Messages` (`ConversationId`,`CreatedAt`);--> statement-breakpoint
CREATE TABLE `Mutes` (
	`UserId` text NOT NULL,
	`TargetId` text NOT NULL,
	`CreatedAt` integer NOT NULL,
	PRIMARY KEY(`UserId`, `TargetId`),
	FOREIGN KEY (`UserId`) REFERENCES `Users`(`Id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`TargetId`) REFERENCES `Users`(`Id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `Notifications` (
	`Id` text PRIMARY KEY NOT NULL,
	`UserId` text NOT NULL,
	`ActorId` text NOT NULL,
	`Kind` text NOT NULL,
	`PostId` text,
	`ReadAt` integer,
	`CreatedAt` integer NOT NULL,
	FOREIGN KEY (`UserId`) REFERENCES `Users`(`Id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ActorId`) REFERENCES `Users`(`Id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`PostId`) REFERENCES `Posts`(`Id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `NotificationsUser` ON `Notifications` (`UserId`,`CreatedAt`);--> statement-breakpoint
CREATE TABLE `Participants` (
	`ConversationId` text NOT NULL,
	`UserId` text NOT NULL,
	`State` text DEFAULT 'active' NOT NULL,
	`ReadAt` integer,
	PRIMARY KEY(`ConversationId`, `UserId`),
	FOREIGN KEY (`ConversationId`) REFERENCES `Conversations`(`Id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`UserId`) REFERENCES `Users`(`Id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ParticipantsUser` ON `Participants` (`UserId`);--> statement-breakpoint
CREATE TABLE `Posts` (
	`Id` text PRIMARY KEY NOT NULL,
	`AuthorId` text NOT NULL,
	`ParentId` text,
	`QuoteId` text,
	`Title` text,
	`Body` text DEFAULT '' NOT NULL,
	`Rating` text DEFAULT 'safe' NOT NULL,
	`CreatedAt` integer NOT NULL,
	`DeletedAt` integer,
	FOREIGN KEY (`AuthorId`) REFERENCES `Users`(`Id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ParentId`) REFERENCES `Posts`(`Id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`QuoteId`) REFERENCES `Posts`(`Id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `PostsAuthor` ON `Posts` (`AuthorId`,`CreatedAt`);--> statement-breakpoint
CREATE INDEX `PostsParent` ON `Posts` (`ParentId`,`CreatedAt`);--> statement-breakpoint
CREATE INDEX `PostsRecent` ON `Posts` (`CreatedAt`);--> statement-breakpoint
CREATE TABLE `Preferences` (
	`UserId` text PRIMARY KEY NOT NULL,
	`MaxRating` text DEFAULT 'safe' NOT NULL,
	FOREIGN KEY (`UserId`) REFERENCES `Users`(`Id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `Reports` (
	`Id` text PRIMARY KEY NOT NULL,
	`ReporterId` text,
	`PostId` text,
	`UserId` text,
	`MessageId` text,
	`Reason` text NOT NULL,
	`Status` text DEFAULT 'open' NOT NULL,
	`ResolverId` text,
	`CreatedAt` integer NOT NULL,
	FOREIGN KEY (`ReporterId`) REFERENCES `Users`(`Id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`PostId`) REFERENCES `Posts`(`Id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`UserId`) REFERENCES `Users`(`Id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`MessageId`) REFERENCES `Messages`(`Id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ResolverId`) REFERENCES `Users`(`Id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "ReportsTarget" CHECK(("Reports"."PostId" IS NOT NULL) + ("Reports"."UserId" IS NOT NULL) + ("Reports"."MessageId" IS NOT NULL) = 1)
);
--> statement-breakpoint
CREATE INDEX `ReportsStatus` ON `Reports` (`Status`,`CreatedAt`);--> statement-breakpoint
CREATE TABLE `Sessions` (
	`Id` text PRIMARY KEY NOT NULL,
	`UserId` text NOT NULL,
	`Hash` text NOT NULL,
	`ExpiresAt` integer NOT NULL,
	`CreatedAt` integer NOT NULL,
	FOREIGN KEY (`UserId`) REFERENCES `Users`(`Id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Sessions_Hash_unique` ON `Sessions` (`Hash`);--> statement-breakpoint
CREATE TABLE `Snapshots` (
	`Id` text PRIMARY KEY NOT NULL,
	`CrosspostId` text NOT NULL,
	`Views` integer DEFAULT 0 NOT NULL,
	`Faves` integer DEFAULT 0 NOT NULL,
	`Comments` integer DEFAULT 0 NOT NULL,
	`TakenAt` integer NOT NULL,
	FOREIGN KEY (`CrosspostId`) REFERENCES `Crossposts`(`Id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `SnapshotsCrosspost` ON `Snapshots` (`CrosspostId`,`TakenAt`);--> statement-breakpoint
CREATE TABLE `Tags` (
	`PostId` text NOT NULL,
	`Tag` text NOT NULL,
	PRIMARY KEY(`PostId`, `Tag`),
	FOREIGN KEY (`PostId`) REFERENCES `Posts`(`Id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `TagsLookup` ON `Tags` (`Tag`);--> statement-breakpoint
CREATE TABLE `Users` (
	`Id` text PRIMARY KEY NOT NULL,
	`Username` text NOT NULL,
	`Display` text NOT NULL,
	`Bio` text DEFAULT '' NOT NULL,
	`Avatar` text,
	`City` text,
	`Region` text,
	`Role` text DEFAULT 'member' NOT NULL,
	`CreatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Users_Username_unique` ON `Users` (`Username`);--> statement-breakpoint
CREATE INDEX `UsersCity` ON `Users` (`City`,`Region`);