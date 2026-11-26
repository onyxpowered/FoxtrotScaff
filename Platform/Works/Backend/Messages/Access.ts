import { and, eq, ne, sql } from "drizzle-orm";
import { Database } from "../Store/Database.ts";
import { Participants } from "../Store/Schema.ts";
import { Fail } from "../Store/Fail.ts";

export function Between(A: string, B: string) {
  return Database.all<{ ConversationId: string }>(sql`
    SELECT Mine.ConversationId AS ConversationId
    FROM Participants Mine
    JOIN Participants Theirs ON Theirs.ConversationId = Mine.ConversationId
    WHERE Mine.UserId = ${A} AND Theirs.UserId = ${B}
      AND (SELECT count(*) FROM Participants WHERE ConversationId = Mine.ConversationId) = 2
    LIMIT 1
  `)[0]?.ConversationId ?? null;
}

export function Member(ConversationId: string, UserId: string) {
  const Row = Database
    .select()
    .from(Participants)
    .where(and(eq(Participants.ConversationId, ConversationId), eq(Participants.UserId, UserId)))
    .get();
  if (!Row) throw new Fail(404, "Conversation not found");
  return Row;
}

export function Counterpart(ConversationId: string, UserId: string) {
  const Row = Database
    .select()
    .from(Participants)
    .where(and(eq(Participants.ConversationId, ConversationId), ne(Participants.UserId, UserId)))
    .get();
  if (!Row) throw new Fail(409, "Nobody else is in this conversation");
  return Row;
}
