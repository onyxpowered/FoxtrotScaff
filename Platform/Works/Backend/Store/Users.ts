import { and, eq, sql } from "drizzle-orm";
import { Database } from "./Database.ts";
import { Users, Follows, Posts, Blocks, Mutes } from "./Schema.ts";
import { Fail } from "./Fail.ts";

export type User = typeof Users.$inferSelect;

export function ById(Id: string) {
  return Database.select().from(Users).where(eq(Users.Id, Id)).get() ?? null;
}

export function ByUsername(Username: string) {
  return Database.select().from(Users).where(eq(Users.Username, Username.toLowerCase())).get() ?? null;
}

export function Count() {
  return Database.select({ N: sql<number>`count(*)` }).from(Users).get()?.N ?? 0;
}

export function Public(Row: User) {
  return {
    Id: Row.Id,
    Username: Row.Username,
    Display: Row.Display,
    Bio: Row.Bio,
    Avatar: Row.Avatar,
    City: Row.City,
    Region: Row.Region,
    Role: Row.Role,
    CreatedAt: Row.CreatedAt,
  };
}

export type Patch = {
  Display?: string;
  Bio?: string;
  Avatar?: string | null;
  City?: string | null;
  Region?: string | null;
};

export function Update(Id: string, Changes: Patch) {
  if (Object.keys(Changes).length > 0) Database.update(Users).set(Changes).where(eq(Users.Id, Id)).run();
  return Public(ById(Id)!);
}

export function Remove(Id: string) {
  Database.delete(Users).where(eq(Users.Id, Id)).run();
}

export function Suspend(Id: string, On: boolean) {
  Database.update(Users).set({ SuspendedAt: On ? new Date() : null }).where(eq(Users.Id, Id)).run();
}

function Total(Table: typeof Follows | typeof Posts, Column: any, Value: string) {
  return Database.select({ N: sql<number>`count(*)` }).from(Table).where(eq(Column, Value)).get()?.N ?? 0;
}

export function Profile(Username: string, Viewer: string | null) {
  const Row = ByUsername(Username);
  if (!Row || Row.SuspendedAt) throw new Fail(404, "User not found");
  if (Viewer && Database.select().from(Blocks).where(and(eq(Blocks.UserId, Row.Id), eq(Blocks.TargetId, Viewer))).get()) {
    throw new Fail(404, "User not found");
  }

  const Posted = Database
    .select({ N: sql<number>`count(*)` })
    .from(Posts)
    .where(sql`${Posts.AuthorId} = ${Row.Id} AND ${Posts.DeletedAt} IS NULL AND ${Posts.ParentId} IS NULL`)
    .get()?.N ?? 0;

  const Relation = Viewer && Viewer !== Row.Id
    ? {
        Following: Boolean(Database.select().from(Follows).where(and(eq(Follows.UserId, Viewer), eq(Follows.TargetId, Row.Id))).get()),
        FollowedBy: Boolean(Database.select().from(Follows).where(and(eq(Follows.UserId, Row.Id), eq(Follows.TargetId, Viewer))).get()),
        Blocked: Boolean(Database.select().from(Blocks).where(and(eq(Blocks.UserId, Viewer), eq(Blocks.TargetId, Row.Id))).get()),
        Muted: Boolean(Database.select().from(Mutes).where(and(eq(Mutes.UserId, Viewer), eq(Mutes.TargetId, Row.Id))).get()),
      }
    : null;

  return {
    ...Public(Row),
    Followers: Total(Follows, Follows.TargetId, Row.Id),
    Following: Total(Follows, Follows.UserId, Row.Id),
    Posts: Posted,
    Relation,
  };
}
