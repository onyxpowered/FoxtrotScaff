import { asc, eq, inArray } from "drizzle-orm";
import { Database } from "../Store/Database.ts";
import { Attachments, Blobs, Messages, Reactions } from "../Store/Schema.ts";
import { Group } from "../Store/Group.ts";

export type Row = typeof Messages.$inferSelect;

export function Present(Rows: Row[], Viewer: string) {
  if (Rows.length === 0) return [];
  const Ids = Rows.map((Row) => Row.Id);

  const Files = Group(
    Database
      .select({ MessageId: Attachments.MessageId, Hash: Attachments.Hash, Name: Attachments.Name, Alt: Attachments.Alt, Position: Attachments.Position, Kind: Blobs.Kind, Mime: Blobs.Mime, Ext: Blobs.Ext, Size: Blobs.Size })
      .from(Attachments)
      .innerJoin(Blobs, eq(Blobs.Hash, Attachments.Hash))
      .where(inArray(Attachments.MessageId, Ids))
      .orderBy(asc(Attachments.Position))
      .all(),
    (Row) => Row.MessageId,
  );

  const Hearts = Group(
    Database.select().from(Reactions).where(inArray(Reactions.MessageId, Ids)).orderBy(asc(Reactions.CreatedAt)).all(),
    (Row) => Row.MessageId,
  );

  const Quoted = new Map(
    Database
      .select()
      .from(Messages)
      .where(inArray(Messages.Id, [...new Set(Rows.map((Row) => Row.ReplyId).filter((Id): Id is string => Id !== null))]))
      .all()
      .map((Row) => [Row.Id, Row] as const),
  );
  const Quotes = Group(
    Database
      .select({ MessageId: Attachments.MessageId })
      .from(Attachments)
      .where(inArray(Attachments.MessageId, [...Quoted.keys()]))
      .all(),
    (Row) => Row.MessageId,
  );

  return Rows.map((Row) => {
    const Tally = new Map<string, { Count: number; Mine: boolean }>();
    for (const Heart of Hearts.get(Row.Id) ?? []) {
      const Entry = Tally.get(Heart.Emoji) ?? { Count: 0, Mine: false };
      Entry.Count += 1;
      Entry.Mine = Entry.Mine || Heart.UserId === Viewer;
      Tally.set(Heart.Emoji, Entry);
    }

    const Parent = Row.ReplyId ? Quoted.get(Row.ReplyId) : undefined;

    return {
      Id: Row.Id,
      ConversationId: Row.ConversationId,
      SenderId: Row.SenderId,
      Body: Row.DeletedAt ? "" : Row.Body,
      Deleted: Row.DeletedAt !== null,
      EditedAt: Row.EditedAt,
      CreatedAt: Row.CreatedAt,
      Reply: Parent
        ? { Id: Parent.Id, SenderId: Parent.SenderId, Body: Parent.DeletedAt ? "" : Parent.Body.slice(0, 140), Deleted: Parent.DeletedAt !== null, Attachments: Quotes.get(Parent.Id)?.length ?? 0 }
        : null,
      Attachments: (Files.get(Row.Id) ?? []).map(({ Hash, Name, Alt, Kind, Mime, Ext, Size }) => ({ Hash, Name, Alt, Kind, Mime, Ext, Size })),
      Reactions: [...Tally].map(([Emoji, Entry]) => ({ Emoji, ...Entry })),
    };
  });
}
