import { and, desc, eq, isNull, lt, sql } from "drizzle-orm";
import { Database } from "./Database.ts";
import { Notifications, Users } from "./Schema.ts";
import { Id } from "./Id.ts";
import { Blocked } from "./Social.ts";
import { Public } from "./Users.ts";

export type Kind = "follow" | "fave" | "reply" | "mention" | "quote";

export function Notify(UserId: string, ActorId: string, Kind: Kind, PostId: string | null = null) {
  if (UserId === ActorId || Blocked(UserId, ActorId)) return;
  Database.insert(Notifications).values({ Id: Id(), UserId, ActorId, Kind, PostId, CreatedAt: new Date() }).run();
}

export function List(UserId: string, Before: string | undefined, Limit: number) {
  const Rows = Database
    .select({ Notice: Notifications, Actor: Users })
    .from(Notifications)
    .innerJoin(Users, eq(Users.Id, Notifications.ActorId))
    .where(and(eq(Notifications.UserId, UserId), Before ? lt(Notifications.Id, Before) : undefined))
    .orderBy(desc(Notifications.Id))
    .limit(Limit + 1)
    .all();
  const Page = Rows.slice(0, Limit);
  return {
    Notifications: Page.map((Row) => ({
      Id: Row.Notice.Id,
      Kind: Row.Notice.Kind,
      PostId: Row.Notice.PostId,
      Actor: Public(Row.Actor),
      Read: Row.Notice.ReadAt !== null,
      CreatedAt: Row.Notice.CreatedAt,
    })),
    Next: Rows.length > Limit ? Page.at(-1)!.Notice.Id : null,
  };
}

export function Unread(UserId: string) {
  return Database
    .select({ N: sql<number>`count(*)` })
    .from(Notifications)
    .where(and(eq(Notifications.UserId, UserId), isNull(Notifications.ReadAt)))
    .get()?.N ?? 0;
}

export function Clear(UserId: string) {
  Database.update(Notifications).set({ ReadAt: new Date() }).where(and(eq(Notifications.UserId, UserId), isNull(Notifications.ReadAt))).run();
}
