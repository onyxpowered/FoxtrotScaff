import { and, desc, eq, or } from "drizzle-orm";
import { Database } from "./Database.ts";
import { Follows, Blocks, Mutes, Faves, Users } from "./Schema.ts";
import { Public } from "./Users.ts";

export function Blocked(A: string, B: string) {
  return Boolean(
    Database
      .select()
      .from(Blocks)
      .where(or(and(eq(Blocks.UserId, A), eq(Blocks.TargetId, B)), and(eq(Blocks.UserId, B), eq(Blocks.TargetId, A))))
      .get(),
  );
}

export function IsFollowing(UserId: string, TargetId: string) {
  return Boolean(Database.select().from(Follows).where(and(eq(Follows.UserId, UserId), eq(Follows.TargetId, TargetId))).get());
}

export function Follow(UserId: string, TargetId: string) {
  return Database.insert(Follows).values({ UserId, TargetId, CreatedAt: new Date() }).onConflictDoNothing().returning({ Id: Follows.UserId }).all().length > 0;
}

export function Unfollow(UserId: string, TargetId: string) {
  return Database.delete(Follows).where(and(eq(Follows.UserId, UserId), eq(Follows.TargetId, TargetId))).returning({ Id: Follows.UserId }).all().length > 0;
}

export function Block(UserId: string, TargetId: string) {
  return Database.transaction((Tx) => {
    Tx.delete(Follows)
      .where(or(and(eq(Follows.UserId, UserId), eq(Follows.TargetId, TargetId)), and(eq(Follows.UserId, TargetId), eq(Follows.TargetId, UserId))))
      .run();
    return Tx.insert(Blocks).values({ UserId, TargetId, CreatedAt: new Date() }).onConflictDoNothing().returning({ Id: Blocks.UserId }).all().length > 0;
  });
}

export function Unblock(UserId: string, TargetId: string) {
  return Database.delete(Blocks).where(and(eq(Blocks.UserId, UserId), eq(Blocks.TargetId, TargetId))).returning({ Id: Blocks.UserId }).all().length > 0;
}

export function Mute(UserId: string, TargetId: string) {
  return Database.insert(Mutes).values({ UserId, TargetId, CreatedAt: new Date() }).onConflictDoNothing().returning({ Id: Mutes.UserId }).all().length > 0;
}

export function Unmute(UserId: string, TargetId: string) {
  return Database.delete(Mutes).where(and(eq(Mutes.UserId, UserId), eq(Mutes.TargetId, TargetId))).returning({ Id: Mutes.UserId }).all().length > 0;
}

export function Fave(UserId: string, PostId: string) {
  return Database.insert(Faves).values({ UserId, PostId, CreatedAt: new Date() }).onConflictDoNothing().returning({ Id: Faves.UserId }).all().length > 0;
}

export function Unfave(UserId: string, PostId: string) {
  return Database.delete(Faves).where(and(eq(Faves.UserId, UserId), eq(Faves.PostId, PostId))).returning({ Id: Faves.UserId }).all().length > 0;
}

export function Followers(UserId: string, Limit: number, Offset: number) {
  return Database
    .select({ User: Users })
    .from(Follows)
    .innerJoin(Users, eq(Users.Id, Follows.UserId))
    .where(eq(Follows.TargetId, UserId))
    .orderBy(desc(Follows.CreatedAt))
    .limit(Limit)
    .offset(Offset)
    .all()
    .map((Row) => Public(Row.User));
}

export function Following(UserId: string, Limit: number, Offset: number) {
  return Database
    .select({ User: Users })
    .from(Follows)
    .innerJoin(Users, eq(Users.Id, Follows.TargetId))
    .where(eq(Follows.UserId, UserId))
    .orderBy(desc(Follows.CreatedAt))
    .limit(Limit)
    .offset(Offset)
    .all()
    .map((Row) => Public(Row.User));
}
