import { and, desc, eq, gt, isNull, lt, ne, sql } from "drizzle-orm";
import { Database } from "../Store/Database.ts";
import { Conversations, Messages, Participants, Users } from "../Store/Schema.ts";
import { Public } from "../Store/Users.ts";
import { Member } from "./Access.ts";
import { Present } from "./Present.ts";

export type Section = "active" | "request" | "muted";

function Unseen(ConversationId: string, UserId: string, ReadId: string | null, ClearedId: string | null) {
  return Database
    .select({ N: sql<number>`count(*)` })
    .from(Messages)
    .where(and(
      eq(Messages.ConversationId, ConversationId),
      ne(Messages.SenderId, UserId),
      isNull(Messages.DeletedAt),
      ReadId ? gt(Messages.Id, ReadId) : undefined,
      ClearedId ? gt(Messages.Id, ClearedId) : undefined,
    ))
    .get()?.N ?? 0;
}

function Others(ConversationId: string, UserId: string) {
  return Database
    .select({ User: Users })
    .from(Participants)
    .innerJoin(Users, eq(Users.Id, Participants.UserId))
    .where(and(eq(Participants.ConversationId, ConversationId), ne(Participants.UserId, UserId)))
    .all()
    .map((Other) => Public(Other.User));
}

export function Inbox(UserId: string, Section: Section) {
  const Mine = Database
    .select({ ConversationId: Participants.ConversationId, ReadId: Participants.ReadId, ClearedId: Participants.ClearedId, UpdatedAt: Conversations.UpdatedAt })
    .from(Participants)
    .innerJoin(Conversations, eq(Conversations.Id, Participants.ConversationId))
    .where(and(eq(Participants.UserId, UserId), eq(Participants.State, Section)))
    .orderBy(desc(Conversations.UpdatedAt))
    .limit(50)
    .all();

  const Listed = [];
  for (const Row of Mine) {
    const Last = Database
      .select()
      .from(Messages)
      .where(and(eq(Messages.ConversationId, Row.ConversationId), Row.ClearedId ? gt(Messages.Id, Row.ClearedId) : undefined))
      .orderBy(desc(Messages.Id))
      .limit(1)
      .get();
    if (!Last) continue;

    Listed.push({
      Id: Row.ConversationId,
      With: Others(Row.ConversationId, UserId),
      Last: Present([Last], UserId)[0],
      Unread: Unseen(Row.ConversationId, UserId, Row.ReadId, Row.ClearedId),
      UpdatedAt: Row.UpdatedAt,
    });
  }
  return Listed;
}

export function Thread(ConversationId: string, UserId: string, Before: string | undefined, Limit: number) {
  const Mine = Member(ConversationId, UserId);
  const Rows = Database
    .select()
    .from(Messages)
    .where(and(
      eq(Messages.ConversationId, ConversationId),
      Mine.ClearedId ? gt(Messages.Id, Mine.ClearedId) : undefined,
      Before ? lt(Messages.Id, Before) : undefined,
    ))
    .orderBy(desc(Messages.Id))
    .limit(Limit + 1)
    .all();
  const Page = Rows.slice(0, Limit);

  return {
    Id: ConversationId,
    State: Mine.State,
    With: Others(ConversationId, UserId),
    Messages: Present(Page, UserId),
    Next: Rows.length > Limit ? Page.at(-1)!.Id : null,
  };
}

export function Mark(ConversationId: string, UserId: string, State: "active" | "muted") {
  Member(ConversationId, UserId);
  Database
    .update(Participants)
    .set({ State })
    .where(and(eq(Participants.ConversationId, ConversationId), eq(Participants.UserId, UserId)))
    .run();
}

function Latest(ConversationId: string) {
  return Database.select({ Id: Messages.Id }).from(Messages).where(eq(Messages.ConversationId, ConversationId)).orderBy(desc(Messages.Id)).limit(1).get()?.Id ?? null;
}

export function Read(ConversationId: string, UserId: string) {
  Member(ConversationId, UserId);
  Database
    .update(Participants)
    .set({ ReadAt: new Date(), ReadId: Latest(ConversationId) })
    .where(and(eq(Participants.ConversationId, ConversationId), eq(Participants.UserId, UserId)))
    .run();
}

export function Clear(ConversationId: string, UserId: string) {
  Member(ConversationId, UserId);
  const Newest = Latest(ConversationId);
  Database
    .update(Participants)
    .set({ ReadAt: new Date(), ReadId: Newest, ClearedId: Newest })
    .where(and(eq(Participants.ConversationId, ConversationId), eq(Participants.UserId, UserId)))
    .run();
}

export function StateOf(ConversationId: string, UserId: string) {
  return Member(ConversationId, UserId).State;
}

export function Totals(UserId: string) {
  const Counted = (State: "active" | "request", Distinct: boolean) =>
    Database.all<{ N: number }>(sql`
      SELECT ${Distinct ? sql`count(DISTINCT Participants.ConversationId)` : sql`count(*)`} AS N
      FROM Messages
      JOIN Participants ON Participants.ConversationId = Messages.ConversationId AND Participants.UserId = ${UserId}
      WHERE Participants.State = ${State}
        AND Messages.SenderId != ${UserId}
        AND Messages.DeletedAt IS NULL
        AND (Participants.ReadId IS NULL OR Messages.Id > Participants.ReadId)
        AND (Participants.ClearedId IS NULL OR Messages.Id > Participants.ClearedId)
    `)[0]?.N ?? 0;

  return { Messages: Counted("active", false), Requests: Counted("request", true) };
}
