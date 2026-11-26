import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { Posts } from "./Schema.ts";
import { Allowed, type Rating } from "./Preferences.ts";

export function Visible(Viewer: string, Max: Rating, Filter = true) {
  return and(
    isNull(Posts.DeletedAt),
    or(eq(Posts.AuthorId, Viewer), inArray(Posts.Rating, Allowed(Max))),
    sql`${Posts.AuthorId} NOT IN (SELECT TargetId FROM Blocks WHERE UserId = ${Viewer})`,
    sql`${Posts.AuthorId} NOT IN (SELECT UserId FROM Blocks WHERE TargetId = ${Viewer})`,
    sql`${Posts.AuthorId} NOT IN (SELECT TargetId FROM Mutes WHERE UserId = ${Viewer})`,
    sql`${Posts.AuthorId} NOT IN (SELECT Id FROM Users WHERE SuspendedAt IS NOT NULL)`,
    Filter
      ? sql`(${Posts.AuthorId} = ${Viewer} OR NOT EXISTS (SELECT 1 FROM Tags JOIN Hidden ON Hidden.Tag = Tags.Tag WHERE Tags.PostId = ${Posts.Id} AND Hidden.UserId = ${Viewer}))`
      : undefined,
  );
}
