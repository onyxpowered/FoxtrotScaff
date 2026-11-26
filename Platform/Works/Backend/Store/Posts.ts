import { and, asc, desc, eq, gt, inArray, lt, sql, type SQL } from "drizzle-orm";
import { Database } from "./Database.ts";
import { Posts, Tags, Media, Blobs, Faves, Users } from "./Schema.ts";
import { Id } from "./Id.ts";
import { Group } from "./Group.ts";
import { Fail } from "./Fail.ts";
import { Blocked, IsFollowing } from "./Social.ts";
import { Allows, type ReplyGate } from "./Gate.ts";
import { Notify } from "./Notifications.ts";
import { ById as ById_, ByUsername, Public } from "./Users.ts";
import { Get as Preference, type Rating } from "./Preferences.ts";
import { Visible } from "./Visible.ts";

export type Row = typeof Posts.$inferSelect;

export type Input = {
  Title: string | null;
  Body: string;
  Rating: Rating;
  Tags: string[];
  Media: { Hash: string; Alt: string | null; Name: string | null }[];
  ParentId: string | null;
  QuoteId: string | null;
  ReplyGate: ReplyGate;
};

const Mention = /(?<![a-z0-9_])@([a-z0-9_]{3,24})/g;

export function Mentioned(Body: string) {
  return [...new Set([...Body.toLowerCase().matchAll(Mention)].map((Found) => Found[1]))];
}

function Root(Post: Row) {
  let Top = Post;
  for (let Depth = 0; Depth < 100 && Top.ParentId; Depth++) {
    const Up = ById(Top.ParentId);
    if (!Up) break;
    Top = Up;
  }
  return Top;
}

export function ById(PostId: string) {
  return Database.select().from(Posts).where(eq(Posts.Id, PostId)).get() ?? null;
}

function Reachable(Author: string, TargetId: string | null) {
  if (!TargetId) return null;
  const Target = ById(TargetId);
  if (!Target || Target.DeletedAt || Blocked(Author, Target.AuthorId)) throw new Fail(404, "Post not found");
  return Target;
}

export function Hydrate(Rows: Row[], Viewer: string | null) {
  if (Rows.length === 0) return [];
  const Ids = Rows.map((Row) => Row.Id);
  const AuthorIds = [...new Set(Rows.map((Row) => Row.AuthorId))];

  const Authors = new Map(
    Database.select().from(Users).where(inArray(Users.Id, AuthorIds)).all().map((Row) => [Row.Id, Public(Row)] as const),
  );

  const Attached = Group(
    Database
      .select({ PostId: Media.PostId, Hash: Media.Hash, Kind: Blobs.Kind, Name: Media.Name, Alt: Media.Alt, Position: Media.Position, Mime: Blobs.Mime, Ext: Blobs.Ext, Size: Blobs.Size, Width: Blobs.Width, Height: Blobs.Height })
      .from(Media)
      .innerJoin(Blobs, eq(Blobs.Hash, Media.Hash))
      .where(inArray(Media.PostId, Ids))
      .orderBy(asc(Media.Position))
      .all(),
    (Row) => Row.PostId,
  );

  const Labeled = Group(Database.select().from(Tags).where(inArray(Tags.PostId, Ids)).all(), (Row) => Row.PostId);

  const Hearts = new Map(
    Database
      .select({ PostId: Faves.PostId, N: sql<number>`count(*)` })
      .from(Faves)
      .where(inArray(Faves.PostId, Ids))
      .groupBy(Faves.PostId)
      .all()
      .map((Row) => [Row.PostId, Row.N] as const),
  );

  const Answers = new Map(
    Database
      .select({ ParentId: Posts.ParentId, N: sql<number>`count(*)` })
      .from(Posts)
      .where(and(inArray(Posts.ParentId, Ids), sql`${Posts.DeletedAt} IS NULL`))
      .groupBy(Posts.ParentId)
      .all()
      .map((Row) => [Row.ParentId, Row.N] as const),
  );

  const Mine = new Set(
    Viewer
      ? Database.select({ PostId: Faves.PostId }).from(Faves).where(and(eq(Faves.UserId, Viewer), inArray(Faves.PostId, Ids))).all().map((Row) => Row.PostId)
      : [],
  );

  return Rows.map((Row) => ({
    Id: Row.Id,
    Author: Authors.get(Row.AuthorId)!,
    ParentId: Row.ParentId,
    QuoteId: Row.QuoteId,
    Title: Row.Title,
    Body: Row.Body,
    Rating: Row.Rating,
    ReplyGate: Row.ReplyGate,
    Tags: (Labeled.get(Row.Id) ?? []).map((Tag) => Tag.Tag),
    Media: (Attached.get(Row.Id) ?? []).map(({ Hash, Kind, Name, Alt, Mime, Ext, Size, Width, Height }) => ({ Hash, Kind, Name, Alt, Mime, Ext, Size, Width, Height })),
    Faves: Hearts.get(Row.Id) ?? 0,
    Replies: Answers.get(Row.Id) ?? 0,
    Faved: Mine.has(Row.Id),
    CreatedAt: Row.CreatedAt,
  }));
}

export function Create(AuthorId: string, Input: Input) {
  if (!Input.Body.trim() && Input.Media.length === 0) throw new Fail(400, "Post is empty");

  const Parent = Reachable(AuthorId, Input.ParentId);
  const Quote = Reachable(AuthorId, Input.QuoteId);

  if (Parent) {
    const Top = Root(Parent);
    const Me = ById_(AuthorId);
    const Permitted = Allows({
      Gate: Top.ReplyGate,
      Requester: AuthorId,
      Author: Top.AuthorId,
      Follows: IsFollowing(AuthorId, Top.AuthorId),
      FollowedBy: IsFollowing(Top.AuthorId, AuthorId),
      Mentioned: Boolean(Me) && Mentioned(Top.Body).includes(Me!.Username),
    });
    if (!Permitted) throw new Fail(403, "The author limited who can reply");
  }

  const Known = new Map(
    Input.Media.length > 0
      ? Database.select().from(Blobs).where(inArray(Blobs.Hash, Input.Media.map((Item) => Item.Hash))).all().map((Blob) => [Blob.Hash, Blob] as const)
      : [],
  );
  for (const Item of Input.Media) if (!Known.has(Item.Hash)) throw new Fail(400, "Unknown media");

  const Post: Row = {
    Id: Id(),
    AuthorId,
    ParentId: Input.ParentId,
    QuoteId: Input.QuoteId,
    Title: Input.Title,
    Body: Input.Body,
    Rating: Input.Rating,
    ReplyGate: Parent ? "everyone" : Input.ReplyGate,
    CreatedAt: new Date(),
    DeletedAt: null,
  };

  Database.transaction((Tx) => {
    Tx.insert(Posts).values(Post).run();
    if (Input.Tags.length > 0) Tx.insert(Tags).values(Input.Tags.map((Tag) => ({ PostId: Post.Id, Tag }))).onConflictDoNothing().run();
    if (Input.Media.length > 0) {
      Tx.insert(Media)
        .values(Input.Media.map((Item, Position) => ({
          Id: Id(),
          PostId: Post.Id,
          Hash: Item.Hash,
          Kind: Known.get(Item.Hash)!.Kind,
          Name: Item.Name,
          Alt: Item.Alt,
          Position,
        })))
        .run();
    }
  });

  const Told = new Set<string>();
  if (Parent) {
    Notify(Parent.AuthorId, AuthorId, "reply", Post.Id);
    Told.add(Parent.AuthorId);
  }
  if (Quote && !Told.has(Quote.AuthorId)) {
    Notify(Quote.AuthorId, AuthorId, "quote", Post.Id);
    Told.add(Quote.AuthorId);
  }
  for (const Match of Mentioned(Input.Body)) {
    const Target = ByUsername(Match);
    if (Target && !Told.has(Target.Id)) Notify(Target.Id, AuthorId, "mention", Post.Id);
  }

  return Hydrate([Post], AuthorId)[0];
}

export function Remove(PostId: string) {
  Database.update(Posts).set({ DeletedAt: new Date() }).where(eq(Posts.Id, PostId)).run();
}

export function Page(Viewer: string, Where: SQL | undefined, Before: string | undefined, Limit: number) {
  const Max = Preference(Viewer).MaxRating;
  const Rows = Database
    .select()
    .from(Posts)
    .where(and(Visible(Viewer, Max), Where, Before ? lt(Posts.Id, Before) : undefined))
    .orderBy(desc(Posts.Id))
    .limit(Limit + 1)
    .all();
  const Slice = Rows.slice(0, Limit);
  return { Posts: Hydrate(Slice, Viewer), Next: Rows.length > Limit ? Slice.at(-1)!.Id : null };
}

export function Show(PostId: string, Viewer: string) {
  const Max = Preference(Viewer).MaxRating;
  const Row = Database.select().from(Posts).where(and(eq(Posts.Id, PostId), Visible(Viewer, Max, false))).get();
  if (!Row) throw new Fail(404, "Post not found");
  return Hydrate([Row], Viewer)[0];
}

export function Replies(ParentId: string, Viewer: string, After: string | undefined, Limit: number) {
  const Max = Preference(Viewer).MaxRating;
  const Rows = Database
    .select()
    .from(Posts)
    .where(and(eq(Posts.ParentId, ParentId), Visible(Viewer, Max, false), After ? gt(Posts.Id, After) : undefined))
    .orderBy(asc(Posts.Id))
    .limit(Limit + 1)
    .all();
  const Slice = Rows.slice(0, Limit);
  return { Posts: Hydrate(Slice, Viewer), Next: Rows.length > Limit ? Slice.at(-1)!.Id : null };
}
