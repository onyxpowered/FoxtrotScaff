import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { Database } from "./Database.ts";
import { Posts, Users, Blocks } from "./Schema.ts";
import { Get as Preference } from "./Preferences.ts";
import { Hydrate } from "./Posts.ts";
import { Public } from "./Users.ts";
import { Visible } from "./Visible.ts";

function Match(Query: string) {
  const Words = Query.match(/[\p{L}\p{N}_]+/gu) ?? [];
  return Words.slice(0, 8).map((Word) => `"${Word}"*`).join(" ");
}

export function ForPosts(Query: string, Viewer: string, Limit: number) {
  const Expression = Match(Query);
  if (!Expression) return [];

  const Ranked = Database
    .all<{ Id: string }>(sql`SELECT Posts.Id AS Id FROM SearchPosts JOIN Posts ON Posts.rowid = SearchPosts.rowid WHERE SearchPosts MATCH ${Expression} ORDER BY SearchPosts.rank LIMIT ${Limit * 3}`)
    .map((Row) => Row.Id);
  if (Ranked.length === 0) return [];

  const Max = Preference(Viewer).MaxRating;
  const Found = new Map(
    Database.select().from(Posts).where(and(inArray(Posts.Id, Ranked), Visible(Viewer, Max))).all().map((Row) => [Row.Id, Row] as const),
  );
  const Rows = Ranked.map((PostId) => Found.get(PostId)).filter((Row) => Row !== undefined).slice(0, Limit);
  return Hydrate(Rows, Viewer);
}

export function ForUsers(Query: string, Viewer: string, Limit: number) {
  const Expression = Match(Query);
  if (!Expression) return [];

  const Ranked = Database
    .all<{ Id: string }>(sql`SELECT Users.Id AS Id FROM SearchUsers JOIN Users ON Users.rowid = SearchUsers.rowid WHERE SearchUsers MATCH ${Expression} ORDER BY SearchUsers.rank LIMIT ${Limit * 3}`)
    .map((Row) => Row.Id);
  if (Ranked.length === 0) return [];

  const Hidden = new Set(
    Database
      .select({ A: Blocks.UserId, B: Blocks.TargetId })
      .from(Blocks)
      .where(sql`${Blocks.UserId} = ${Viewer} OR ${Blocks.TargetId} = ${Viewer}`)
      .all()
      .flatMap((Row) => [Row.A, Row.B]),
  );

  const Found = new Map(
    Database.select().from(Users).where(and(inArray(Users.Id, Ranked), isNull(Users.SuspendedAt))).all().map((Row) => [Row.Id, Row] as const),
  );
  return Ranked
    .map((UserId) => Found.get(UserId))
    .filter((Row) => Row !== undefined && (!Hidden.has(Row.Id) || Row.Id === Viewer))
    .slice(0, Limit)
    .map((Row) => Public(Row!));
}
