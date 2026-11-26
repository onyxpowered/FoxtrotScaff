import { and, asc, desc, eq } from "drizzle-orm";
import { Database } from "./Database.ts";
import { Connections, Crossposts, Snapshots, Posts } from "./Schema.ts";
import { Id } from "./Id.ts";
import { Fail } from "./Fail.ts";
import { Seal } from "../Auth/Vault.ts";

export type Input = { Platform: string; Handle: string; Mode: "oauth" | "session"; Secret: string | null };

export type Progress = { Status: "queued" | "posted" | "failed"; RemoteId: string | null; RemoteUrl: string | null; Error: string | null };

function Describe(Row: typeof Connections.$inferSelect) {
  return {
    Id: Row.Id,
    Platform: Row.Platform,
    Handle: Row.Handle,
    Mode: Row.Mode,
    Status: Row.Status,
    Sealed: Row.Secret !== null,
    CheckedAt: Row.CheckedAt,
    CreatedAt: Row.CreatedAt,
  };
}

export function Link(UserId: string, Input: Input) {
  const Exists = Database
    .select()
    .from(Connections)
    .where(and(eq(Connections.UserId, UserId), eq(Connections.Platform, Input.Platform), eq(Connections.Handle, Input.Handle)))
    .get();
  if (Exists) throw new Fail(409, "Already connected");

  const Row = {
    Id: Id(),
    UserId,
    Platform: Input.Platform,
    Handle: Input.Handle,
    Mode: Input.Mode,
    Secret: Input.Secret ? Seal(Input.Secret) : null,
    Status: "active" as const,
    CheckedAt: null,
    CreatedAt: new Date(),
  };
  Database.insert(Connections).values(Row).run();
  return Describe(Row);
}

export function List(UserId: string) {
  return Database.select().from(Connections).where(eq(Connections.UserId, UserId)).orderBy(asc(Connections.CreatedAt)).all().map(Describe);
}

export function Unlink(UserId: string, ConnectionId: string) {
  return Database.delete(Connections).where(and(eq(Connections.Id, ConnectionId), eq(Connections.UserId, UserId))).returning({ Id: Connections.Id }).all().length > 0;
}

export function Queue(UserId: string, PostId: string, ConnectionId: string) {
  const Post = Database.select().from(Posts).where(eq(Posts.Id, PostId)).get();
  if (!Post || Post.AuthorId !== UserId || Post.DeletedAt) throw new Fail(404, "Post not found");

  const Connection = Database.select().from(Connections).where(and(eq(Connections.Id, ConnectionId), eq(Connections.UserId, UserId))).get();
  if (!Connection) throw new Fail(404, "Connection not found");
  if (Connection.Status !== "active") throw new Fail(409, "Connection is not active");

  const Exists = Database.select().from(Crossposts).where(and(eq(Crossposts.PostId, PostId), eq(Crossposts.ConnectionId, ConnectionId))).get();
  if (Exists) throw new Fail(409, "Already queued for this connection");

  const Row = { Id: Id(), PostId, ConnectionId, Status: "queued" as const, RemoteId: null, RemoteUrl: null, Error: null, CreatedAt: new Date(), PostedAt: null };
  Database.insert(Crossposts).values(Row).run();
  return Row;
}

function Owned(UserId: string, CrosspostId: string) {
  const Row = Database
    .select({ Crosspost: Crossposts })
    .from(Crossposts)
    .innerJoin(Connections, eq(Connections.Id, Crossposts.ConnectionId))
    .where(and(eq(Crossposts.Id, CrosspostId), eq(Connections.UserId, UserId)))
    .get();
  if (!Row) throw new Fail(404, "Crosspost not found");
  return Row.Crosspost;
}

export function Report(UserId: string, CrosspostId: string, Result: Progress) {
  Owned(UserId, CrosspostId);
  Database
    .update(Crossposts)
    .set({ ...Result, PostedAt: Result.Status === "posted" ? new Date() : null })
    .where(eq(Crossposts.Id, CrosspostId))
    .run();
  return Owned(UserId, CrosspostId);
}

export function Snap(UserId: string, CrosspostId: string, Counts: { Views: number; Faves: number; Comments: number }) {
  Owned(UserId, CrosspostId);
  const Row = { Id: Id(), CrosspostId, ...Counts, TakenAt: new Date() };
  Database.insert(Snapshots).values(Row).run();
  return Row;
}

export function Analytics(UserId: string, PostId: string) {
  const Post = Database.select().from(Posts).where(eq(Posts.Id, PostId)).get();
  if (!Post || Post.AuthorId !== UserId) throw new Fail(404, "Post not found");

  const Rows = Database
    .select({ Crosspost: Crossposts, Connection: Connections })
    .from(Crossposts)
    .innerJoin(Connections, eq(Connections.Id, Crossposts.ConnectionId))
    .where(eq(Crossposts.PostId, PostId))
    .all();

  const Channels = Rows.map(({ Crosspost, Connection }) => {
    const Series = Database.select().from(Snapshots).where(eq(Snapshots.CrosspostId, Crosspost.Id)).orderBy(desc(Snapshots.TakenAt)).limit(100).all().reverse();
    return {
      Id: Crosspost.Id,
      Platform: Connection.Platform,
      Handle: Connection.Handle,
      Status: Crosspost.Status,
      RemoteUrl: Crosspost.RemoteUrl,
      Error: Crosspost.Error,
      Latest: Series.at(-1) ?? null,
      Series,
    };
  });

  const Total = Channels.reduce(
    (Sum, Channel) => ({
      Views: Sum.Views + (Channel.Latest?.Views ?? 0),
      Faves: Sum.Faves + (Channel.Latest?.Faves ?? 0),
      Comments: Sum.Comments + (Channel.Latest?.Comments ?? 0),
    }),
    { Views: 0, Faves: 0, Comments: 0 },
  );

  return { Total, Channels };
}
