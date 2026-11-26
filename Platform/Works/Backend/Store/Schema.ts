import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, primaryKey, index, uniqueIndex, check, type AnySQLiteColumn } from "drizzle-orm/sqlite-core";

export const Users = sqliteTable("Users", {
  Id:        text("Id").primaryKey(),
  Username:  text("Username").notNull().unique(),
  Display:   text("Display").notNull(),
  Bio:       text("Bio").notNull().default(""),
  Avatar:    text("Avatar"),
  City:      text("City"),
  Region:    text("Region"),
  Role:        text("Role", { enum: ["member", "mod", "admin"] }).notNull().default("member"),
  SuspendedAt: integer("SuspendedAt", { mode: "timestamp" }),
  PledgedAt:   integer("PledgedAt", { mode: "timestamp" }),
  CreatedAt:   integer("CreatedAt", { mode: "timestamp" }).notNull(),
}, (T) => [
  index("UsersCity").on(T.City, T.Region),
]);

export const Credentials = sqliteTable("Credentials", {
  UserId:    text("UserId").primaryKey().references(() => Users.Id, { onDelete: "cascade" }),
  Hash:      text("Hash").notNull(),
  CreatedAt: integer("CreatedAt", { mode: "timestamp" }).notNull(),
});

export const Sessions = sqliteTable("Sessions", {
  Id:        text("Id").primaryKey(),
  UserId:    text("UserId").notNull().references(() => Users.Id, { onDelete: "cascade" }),
  Hash:      text("Hash").notNull().unique(),
  ExpiresAt: integer("ExpiresAt", { mode: "timestamp" }).notNull(),
  CreatedAt: integer("CreatedAt", { mode: "timestamp" }).notNull(),
});

export const Invites = sqliteTable("Invites", {
  Id:        text("Id").primaryKey(),
  CreatorId: text("CreatorId").references(() => Users.Id, { onDelete: "set null" }),
  Code:      text("Code").notNull().unique(),
  UsedBy:    text("UsedBy").references(() => Users.Id, { onDelete: "set null" }),
  UsedAt:    integer("UsedAt", { mode: "timestamp" }),
  CreatedAt: integer("CreatedAt", { mode: "timestamp" }).notNull(),
});

export const Preferences = sqliteTable("Preferences", {
  UserId:    text("UserId").primaryKey().references(() => Users.Id, { onDelete: "cascade" }),
  MaxRating: text("MaxRating", { enum: ["safe", "mature", "adult"] }).notNull().default("safe"),
});

export const Posts = sqliteTable("Posts", {
  Id:        text("Id").primaryKey(),
  AuthorId:  text("AuthorId").notNull().references(() => Users.Id, { onDelete: "cascade" }),
  ParentId:  text("ParentId").references((): AnySQLiteColumn => Posts.Id, { onDelete: "set null" }),
  QuoteId:   text("QuoteId").references((): AnySQLiteColumn => Posts.Id, { onDelete: "set null" }),
  Title:     text("Title"),
  Body:      text("Body").notNull().default(""),
  Rating:    text("Rating", { enum: ["safe", "mature", "adult"] }).notNull().default("safe"),
  ReplyGate: text("ReplyGate", { enum: ["everyone", "followers", "mutuals", "mentioned", "nobody"] }).notNull().default("everyone"),
  CreatedAt: integer("CreatedAt", { mode: "timestamp" }).notNull(),
  DeletedAt: integer("DeletedAt", { mode: "timestamp" }),
}, (T) => [
  index("PostsAuthor").on(T.AuthorId, T.CreatedAt),
  index("PostsParent").on(T.ParentId, T.CreatedAt),
  index("PostsRecent").on(T.CreatedAt),
]);

export const Tags = sqliteTable("Tags", {
  PostId: text("PostId").notNull().references(() => Posts.Id, { onDelete: "cascade" }),
  Tag:    text("Tag").notNull(),
}, (T) => [
  primaryKey({ columns: [T.PostId, T.Tag] }),
  index("TagsLookup").on(T.Tag),
]);

export const Blobs = sqliteTable("Blobs", {
  Hash:      text("Hash").primaryKey(),
  Mime:      text("Mime").notNull(),
  Kind:      text("Kind", { enum: ["image", "video", "audio", "model", "file"] }).notNull().default("file"),
  Ext:       text("Ext"),
  Size:      integer("Size").notNull(),
  Width:     integer("Width"),
  Height:    integer("Height"),
  CreatedAt: integer("CreatedAt", { mode: "timestamp" }).notNull(),
});

export const Media = sqliteTable("Media", {
  Id:       text("Id").primaryKey(),
  PostId:   text("PostId").notNull().references(() => Posts.Id, { onDelete: "cascade" }),
  Hash:     text("Hash").notNull().references(() => Blobs.Hash),
  Kind:     text("Kind", { enum: ["image", "video", "audio", "model", "file"] }).notNull(),
  Name:     text("Name"),
  Alt:      text("Alt"),
  Position: integer("Position").notNull().default(0),
}, (T) => [
  index("MediaPost").on(T.PostId, T.Position),
  index("MediaHash").on(T.Hash),
]);

export const Follows = sqliteTable("Follows", {
  UserId:    text("UserId").notNull().references(() => Users.Id, { onDelete: "cascade" }),
  TargetId:  text("TargetId").notNull().references(() => Users.Id, { onDelete: "cascade" }),
  CreatedAt: integer("CreatedAt", { mode: "timestamp" }).notNull(),
}, (T) => [
  primaryKey({ columns: [T.UserId, T.TargetId] }),
  index("FollowsTarget").on(T.TargetId),
]);

export const Blocks = sqliteTable("Blocks", {
  UserId:    text("UserId").notNull().references(() => Users.Id, { onDelete: "cascade" }),
  TargetId:  text("TargetId").notNull().references(() => Users.Id, { onDelete: "cascade" }),
  CreatedAt: integer("CreatedAt", { mode: "timestamp" }).notNull(),
}, (T) => [
  primaryKey({ columns: [T.UserId, T.TargetId] }),
]);

export const Mutes = sqliteTable("Mutes", {
  UserId:    text("UserId").notNull().references(() => Users.Id, { onDelete: "cascade" }),
  TargetId:  text("TargetId").notNull().references(() => Users.Id, { onDelete: "cascade" }),
  CreatedAt: integer("CreatedAt", { mode: "timestamp" }).notNull(),
}, (T) => [
  primaryKey({ columns: [T.UserId, T.TargetId] }),
]);

export const Faves = sqliteTable("Faves", {
  UserId:    text("UserId").notNull().references(() => Users.Id, { onDelete: "cascade" }),
  PostId:    text("PostId").notNull().references(() => Posts.Id, { onDelete: "cascade" }),
  CreatedAt: integer("CreatedAt", { mode: "timestamp" }).notNull(),
}, (T) => [
  primaryKey({ columns: [T.UserId, T.PostId] }),
  index("FavesPost").on(T.PostId),
]);

export const Conversations = sqliteTable("Conversations", {
  Id:        text("Id").primaryKey(),
  CreatedAt: integer("CreatedAt", { mode: "timestamp" }).notNull(),
  UpdatedAt: integer("UpdatedAt", { mode: "timestamp" }).notNull(),
});

export const Participants = sqliteTable("Participants", {
  ConversationId: text("ConversationId").notNull().references(() => Conversations.Id, { onDelete: "cascade" }),
  UserId:         text("UserId").notNull().references(() => Users.Id, { onDelete: "cascade" }),
  State:          text("State", { enum: ["request", "active", "muted"] }).notNull().default("active"),
  ReadAt:         integer("ReadAt", { mode: "timestamp" }),
  ReadId:         text("ReadId"),
  ClearedId:      text("ClearedId"),
}, (T) => [
  primaryKey({ columns: [T.ConversationId, T.UserId] }),
  index("ParticipantsUser").on(T.UserId),
]);

export const Messages = sqliteTable("Messages", {
  Id:             text("Id").primaryKey(),
  ConversationId: text("ConversationId").notNull().references(() => Conversations.Id, { onDelete: "cascade" }),
  SenderId:       text("SenderId").references(() => Users.Id, { onDelete: "set null" }),
  ReplyId:        text("ReplyId").references((): AnySQLiteColumn => Messages.Id, { onDelete: "set null" }),
  Body:           text("Body").notNull(),
  EditedAt:       integer("EditedAt", { mode: "timestamp" }),
  DeletedAt:      integer("DeletedAt", { mode: "timestamp" }),
  CreatedAt:      integer("CreatedAt", { mode: "timestamp" }).notNull(),
}, (T) => [
  index("MessagesConversation").on(T.ConversationId, T.CreatedAt),
]);

export const Notifications = sqliteTable("Notifications", {
  Id:        text("Id").primaryKey(),
  UserId:    text("UserId").notNull().references(() => Users.Id, { onDelete: "cascade" }),
  ActorId:   text("ActorId").notNull().references(() => Users.Id, { onDelete: "cascade" }),
  Kind:      text("Kind", { enum: ["follow", "fave", "reply", "mention", "quote"] }).notNull(),
  PostId:    text("PostId").references(() => Posts.Id, { onDelete: "cascade" }),
  ReadAt:    integer("ReadAt", { mode: "timestamp" }),
  CreatedAt: integer("CreatedAt", { mode: "timestamp" }).notNull(),
}, (T) => [
  index("NotificationsUser").on(T.UserId, T.CreatedAt),
]);

export const Reports = sqliteTable("Reports", {
  Id:         text("Id").primaryKey(),
  ReporterId: text("ReporterId").references(() => Users.Id, { onDelete: "set null" }),
  PostId:     text("PostId").references(() => Posts.Id, { onDelete: "cascade" }),
  UserId:     text("UserId").references(() => Users.Id, { onDelete: "cascade" }),
  MessageId:  text("MessageId").references(() => Messages.Id, { onDelete: "cascade" }),
  Category:   text("Category", { enum: ["ai", "spam", "harassment", "adult", "other"] }).notNull().default("other"),
  Reason:     text("Reason").notNull(),
  Evidence:   text("Evidence"),
  Status:     text("Status", { enum: ["open", "actioned", "dismissed"] }).notNull().default("open"),
  ResolverId: text("ResolverId").references(() => Users.Id, { onDelete: "set null" }),
  CreatedAt:  integer("CreatedAt", { mode: "timestamp" }).notNull(),
}, (T) => [
  index("ReportsStatus").on(T.Status, T.CreatedAt),
  check("ReportsTarget", sql`(${T.PostId} IS NOT NULL) + (${T.UserId} IS NOT NULL) + (${T.MessageId} IS NOT NULL) = 1`),
]);

export const Connections = sqliteTable("Connections", {
  Id:        text("Id").primaryKey(),
  UserId:    text("UserId").notNull().references(() => Users.Id, { onDelete: "cascade" }),
  Platform:  text("Platform").notNull(),
  Handle:    text("Handle").notNull(),
  Mode:      text("Mode", { enum: ["oauth", "session"] }).notNull(),
  Secret:    text("Secret"),
  Status:    text("Status", { enum: ["active", "expired", "revoked"] }).notNull().default("active"),
  CheckedAt: integer("CheckedAt", { mode: "timestamp" }),
  CreatedAt: integer("CreatedAt", { mode: "timestamp" }).notNull(),
}, (T) => [
  uniqueIndex("ConnectionsAccount").on(T.UserId, T.Platform, T.Handle),
]);

export const Crossposts = sqliteTable("Crossposts", {
  Id:           text("Id").primaryKey(),
  PostId:       text("PostId").notNull().references(() => Posts.Id, { onDelete: "cascade" }),
  ConnectionId: text("ConnectionId").notNull().references(() => Connections.Id, { onDelete: "cascade" }),
  Status:       text("Status", { enum: ["queued", "posted", "failed"] }).notNull().default("queued"),
  RemoteId:     text("RemoteId"),
  RemoteUrl:    text("RemoteUrl"),
  Error:        text("Error"),
  CreatedAt:    integer("CreatedAt", { mode: "timestamp" }).notNull(),
  PostedAt:     integer("PostedAt", { mode: "timestamp" }),
}, (T) => [
  uniqueIndex("CrosspostsTarget").on(T.PostId, T.ConnectionId),
  index("CrosspostsStatus").on(T.Status),
]);

export const Snapshots = sqliteTable("Snapshots", {
  Id:          text("Id").primaryKey(),
  CrosspostId: text("CrosspostId").notNull().references(() => Crossposts.Id, { onDelete: "cascade" }),
  Views:       integer("Views").notNull().default(0),
  Faves:       integer("Faves").notNull().default(0),
  Comments:    integer("Comments").notNull().default(0),
  TakenAt:     integer("TakenAt", { mode: "timestamp" }).notNull(),
}, (T) => [
  index("SnapshotsCrosspost").on(T.CrosspostId, T.TakenAt),
]);

export const Bans = sqliteTable("Bans", {
  Fingerprint: text("Fingerprint").primaryKey(),
  Reason:      text("Reason").notNull(),
  ExpiresAt:   integer("ExpiresAt", { mode: "timestamp" }),
  CreatedAt:   integer("CreatedAt", { mode: "timestamp" }).notNull(),
});

export const Hidden = sqliteTable("Hidden", {
  UserId:    text("UserId").notNull().references(() => Users.Id, { onDelete: "cascade" }),
  Tag:       text("Tag").notNull(),
  CreatedAt: integer("CreatedAt", { mode: "timestamp" }).notNull(),
}, (T) => [
  primaryKey({ columns: [T.UserId, T.Tag] }),
  index("HiddenTag").on(T.Tag),
]);

export const Uploads = sqliteTable("Uploads", {
  Id:        text("Id").primaryKey(),
  UserId:    text("UserId").notNull().references(() => Users.Id, { onDelete: "cascade" }),
  Hash:      text("Hash").notNull(),
  Size:      integer("Size").notNull(),
  CreatedAt: integer("CreatedAt", { mode: "timestamp" }).notNull(),
}, (T) => [
  index("UploadsUser").on(T.UserId, T.CreatedAt),
]);

export const Attachments = sqliteTable("Attachments", {
  Id:        text("Id").primaryKey(),
  MessageId: text("MessageId").notNull().references(() => Messages.Id, { onDelete: "cascade" }),
  Hash:      text("Hash").notNull().references(() => Blobs.Hash),
  Name:      text("Name"),
  Alt:       text("Alt"),
  Position:  integer("Position").notNull().default(0),
}, (T) => [
  index("AttachmentsMessage").on(T.MessageId, T.Position),
]);

export const Reactions = sqliteTable("Reactions", {
  MessageId: text("MessageId").notNull().references(() => Messages.Id, { onDelete: "cascade" }),
  UserId:    text("UserId").notNull().references(() => Users.Id, { onDelete: "cascade" }),
  Emoji:     text("Emoji").notNull(),
  CreatedAt: integer("CreatedAt", { mode: "timestamp" }).notNull(),
}, (T) => [
  primaryKey({ columns: [T.MessageId, T.UserId, T.Emoji] }),
]);
