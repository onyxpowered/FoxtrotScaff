import { and, asc, eq, sql } from "drizzle-orm";
import { Database } from "./Database.ts";
import { Hidden } from "./Schema.ts";
import { Fail } from "./Fail.ts";

const Allowance = 200;

export function List(UserId: string) {
  return Database.select().from(Hidden).where(eq(Hidden.UserId, UserId)).orderBy(asc(Hidden.Tag)).all().map((Row) => Row.Tag);
}

export function Hide(UserId: string, Tag: string) {
  const Count = Database.select({ N: sql<number>`count(*)` }).from(Hidden).where(eq(Hidden.UserId, UserId)).get()?.N ?? 0;
  if (Count >= Allowance) throw new Fail(429, "Too many hidden tags");
  Database.insert(Hidden).values({ UserId, Tag, CreatedAt: new Date() }).onConflictDoNothing().run();
}

export function Show(UserId: string, Tag: string) {
  Database.delete(Hidden).where(and(eq(Hidden.UserId, UserId), eq(Hidden.Tag, Tag))).run();
}
