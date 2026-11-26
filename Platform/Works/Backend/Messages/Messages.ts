import { and, eq, inArray, sql } from "drizzle-orm";
import { Database } from "../Store/Database.ts";
import { Attachments, Blobs, Conversations, Follows, Messages, Participants, Reactions } from "../Store/Schema.ts";
import { Id } from "../Store/Id.ts";
import { Fail } from "../Store/Fail.ts";
import { Blocked } from "../Store/Social.ts";
import { ByUsername } from "../Store/Users.ts";
import { Between, Counterpart, Member } from "./Access.ts";
import { Present } from "./Present.ts";
import { Valid } from "./Emoji.ts";

export type Compose = {
  Body: string;
  Attachments: { Hash: string; Name: string | null; Alt: string | null }[];
  ReplyId: string | null;
};

export const Window = Number(process.env.EDIT_WINDOW_MIN ?? 15) * 60_000;

const Waiting = 3;
const Allowance = 10;

function Validate(Input: Compose, Stranger: boolean, ConversationId: string | null) {
  if (!Input.Body.trim() && Input.Attachments.length === 0) throw new Fail(400, "Message is empty");
  if (Stranger && Input.Attachments.length > 0) throw new Fail(403, "Attachments unlock once they accept your message");

  if (Input.Attachments.length > 0) {
    const Wanted = new Set(Input.Attachments.map((Item) => Item.Hash));
    const Known = Database.select({ Hash: Blobs.Hash }).from(Blobs).where(inArray(Blobs.Hash, [...Wanted])).all();
    if (Known.length !== Wanted.size) throw new Fail(400, "Unknown attachment");
  }

  if (Input.ReplyId) {
    const Target = ConversationId
      ? Database.select().from(Messages).where(and(eq(Messages.Id, Input.ReplyId), eq(Messages.ConversationId, ConversationId))).get()
      : undefined;
    if (!Target || Target.DeletedAt) throw new Fail(400, "Cannot reply to that message");
  }
}

function Guard(ConversationId: string, SenderId: string) {
  const Other = Counterpart(ConversationId, SenderId);
  if (Blocked(SenderId, Other.UserId)) throw new Fail(403, "Cannot message this user");
  if (Other.State === "request") {
    const Sent = Database
      .select({ N: sql<number>`count(*)` })
      .from(Messages)
      .where(and(eq(Messages.ConversationId, ConversationId), eq(Messages.SenderId, SenderId)))
      .get()?.N ?? 0;
    if (Sent >= Waiting) throw new Fail(429, "Waiting for them to accept");
  }
  return Other;
}

function Deliver(ConversationId: string, SenderId: string, Input: Compose) {
  const Now = new Date();
  const Row = { Id: Id(), ConversationId, SenderId, ReplyId: Input.ReplyId, Body: Input.Body.trim(), EditedAt: null, DeletedAt: null, CreatedAt: Now };

  Database.transaction((Tx) => {
    Tx.insert(Messages).values(Row).run();
    if (Input.Attachments.length > 0) {
      Tx.insert(Attachments)
        .values(Input.Attachments.map((Item, Position) => ({ Id: Id(), MessageId: Row.Id, Hash: Item.Hash, Name: Item.Name, Alt: Item.Alt, Position })))
        .run();
    }
    Tx.update(Conversations).set({ UpdatedAt: Now }).where(eq(Conversations.Id, ConversationId)).run();
    Tx.update(Participants)
      .set({ ReadAt: Now, ReadId: Row.Id })
      .where(and(eq(Participants.ConversationId, ConversationId), eq(Participants.UserId, SenderId)))
      .run();
  });
  return Row;
}

export function Send(From: string, ToUsername: string, Input: Compose) {
  const Target = ByUsername(ToUsername);
  if (!Target || Target.SuspendedAt || Target.Id === From) throw new Fail(404, "User not found");
  if (Blocked(From, Target.Id)) throw new Fail(403, "Cannot message this user");

  const Existing = Between(From, Target.Id);
  if (Existing) return Reply(Existing, From, Input);

  const Knows = Boolean(Database.select().from(Follows).where(and(eq(Follows.UserId, Target.Id), eq(Follows.TargetId, From))).get());
  Validate(Input, !Knows, null);

  const ConversationId = Id();
  const Now = new Date();
  Database.transaction((Tx) => {
    Tx.insert(Conversations).values({ Id: ConversationId, CreatedAt: Now, UpdatedAt: Now }).run();
    Tx.insert(Participants).values([
      { ConversationId, UserId: From, State: "active", ReadAt: Now },
      { ConversationId, UserId: Target.Id, State: Knows ? "active" : "request", ReadAt: null },
    ]).run();
  });
  const Row = Deliver(ConversationId, From, Input);
  return { ConversationId, MessageId: Row.Id, Recipient: Target.Id };
}

export function Reply(ConversationId: string, From: string, Input: Compose) {
  Member(ConversationId, From);
  const Other = Guard(ConversationId, From);
  Validate(Input, Other.State === "request", ConversationId);
  const Row = Deliver(ConversationId, From, Input);
  return { ConversationId, MessageId: Row.Id, Recipient: Other.UserId };
}

function Find(ConversationId: string, MessageId: string) {
  const Row = Database.select().from(Messages).where(and(eq(Messages.Id, MessageId), eq(Messages.ConversationId, ConversationId))).get();
  if (!Row) throw new Fail(404, "Message not found");
  return Row;
}

function Own(ConversationId: string, MessageId: string, UserId: string) {
  Member(ConversationId, UserId);
  const Row = Find(ConversationId, MessageId);
  if (Row.SenderId !== UserId) throw new Fail(403, "That is not your message");
  return Row;
}

export function Edit(ConversationId: string, MessageId: string, UserId: string, Body: string) {
  const Row = Own(ConversationId, MessageId, UserId);
  const Other = Counterpart(ConversationId, UserId);
  if (Row.DeletedAt) throw new Fail(409, "Message was deleted");
  if (Date.now() - Row.CreatedAt.getTime() > Window) throw new Fail(403, "Too old to edit");
  if (Blocked(UserId, Other.UserId)) throw new Fail(403, "Cannot edit this message");

  const Text = Body.trim();
  const Files = Database.select({ N: sql<number>`count(*)` }).from(Attachments).where(eq(Attachments.MessageId, MessageId)).get()?.N ?? 0;
  if (!Text && Files === 0) throw new Fail(400, "Message is empty");

  Database.update(Messages).set({ Body: Text, EditedAt: new Date() }).where(eq(Messages.Id, MessageId)).run();
  return { ConversationId, MessageId, Recipient: Other.UserId };
}

export function Remove(ConversationId: string, MessageId: string, UserId: string) {
  const Row = Own(ConversationId, MessageId, UserId);
  const Other = Counterpart(ConversationId, UserId);

  if (!Row.DeletedAt) {
    Database.transaction((Tx) => {
      Tx.update(Messages).set({ Body: "", DeletedAt: new Date() }).where(eq(Messages.Id, MessageId)).run();
      Tx.delete(Attachments).where(eq(Attachments.MessageId, MessageId)).run();
      Tx.delete(Reactions).where(eq(Reactions.MessageId, MessageId)).run();
    });
  }
  return { ConversationId, MessageId, Recipient: Other.UserId };
}

export function React(ConversationId: string, MessageId: string, UserId: string, Emoji: string) {
  if (!Valid(Emoji)) throw new Fail(400, "Pick a single emoji");
  Member(ConversationId, UserId);
  const Other = Counterpart(ConversationId, UserId);
  if (Blocked(UserId, Other.UserId)) throw new Fail(403, "Cannot react to this message");
  if (Find(ConversationId, MessageId).DeletedAt) throw new Fail(409, "Message was deleted");

  const Used = Database.select().from(Reactions).where(and(eq(Reactions.MessageId, MessageId), eq(Reactions.UserId, UserId))).all();
  if (Used.length >= Allowance && !Used.some((Row) => Row.Emoji === Emoji)) throw new Fail(400, "Too many reactions on one message");

  Database.insert(Reactions).values({ MessageId, UserId, Emoji, CreatedAt: new Date() }).onConflictDoNothing().run();
  return { ConversationId, MessageId, Recipient: Other.UserId };
}

export function Unreact(ConversationId: string, MessageId: string, UserId: string, Emoji: string) {
  Member(ConversationId, UserId);
  const Other = Counterpart(ConversationId, UserId);
  Find(ConversationId, MessageId);
  Database.delete(Reactions).where(and(eq(Reactions.MessageId, MessageId), eq(Reactions.UserId, UserId), eq(Reactions.Emoji, Emoji))).run();
  return { ConversationId, MessageId, Recipient: Other.UserId };
}

export function View(MessageId: string, Viewer: string) {
  const Row = Database.select().from(Messages).where(eq(Messages.Id, MessageId)).get();
  return Row ? Present([Row], Viewer)[0] : null;
}
