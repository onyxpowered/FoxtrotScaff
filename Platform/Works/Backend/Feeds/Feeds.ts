import { and, isNull, sql } from "drizzle-orm";
import { Posts } from "../Store/Schema.ts";
import { Page } from "../Store/Posts.ts";
import { ById } from "../Store/Users.ts";
import { Fail } from "../Store/Fail.ts";

export function Home(Viewer: string, Before: string | undefined, Limit: number) {
  return Page(
    Viewer,
    and(
      isNull(Posts.ParentId),
      sql`(${Posts.AuthorId} = ${Viewer} OR ${Posts.AuthorId} IN (SELECT TargetId FROM Follows WHERE UserId = ${Viewer}))`,
    ),
    Before,
    Limit,
  );
}

export function Recent(Viewer: string, Before: string | undefined, Limit: number) {
  return Page(Viewer, isNull(Posts.ParentId), Before, Limit);
}

export function Gallery(Viewer: string, Before: string | undefined, Limit: number) {
  return Page(
    Viewer,
    and(isNull(Posts.ParentId), sql`EXISTS (SELECT 1 FROM Media WHERE Media.PostId = ${Posts.Id})`),
    Before,
    Limit,
  );
}

export function Nearby(Viewer: string, Before: string | undefined, Limit: number) {
  const Me = ById(Viewer);
  if (!Me?.City) throw new Fail(400, "Set your city first");
  const Region = Me.Region ? sql` AND lower(Region) = lower(${Me.Region})` : sql``;
  return Page(
    Viewer,
    and(
      isNull(Posts.ParentId),
      sql`${Posts.AuthorId} IN (SELECT Id FROM Users WHERE lower(City) = lower(${Me.City})${Region})`,
    ),
    Before,
    Limit,
  );
}

export function Tag(Viewer: string, Name: string, Before: string | undefined, Limit: number) {
  return Page(Viewer, sql`${Posts.Id} IN (SELECT PostId FROM Tags WHERE Tag = ${Name})`, Before, Limit);
}

export function Author(Viewer: string, AuthorId: string, Before: string | undefined, Limit: number) {
  return Page(Viewer, and(isNull(Posts.ParentId), sql`${Posts.AuthorId} = ${AuthorId}`), Before, Limit);
}
