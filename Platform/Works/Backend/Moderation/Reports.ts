import { and, desc, eq, lt } from "drizzle-orm";
import { Database } from "../Store/Database.ts";
import { Reports, Posts, Users, Messages, Participants, Attachments } from "../Store/Schema.ts";
import { Id } from "../Store/Id.ts";
import { Fail } from "../Store/Fail.ts";
import { ById, Public, Suspend } from "../Store/Users.ts";
import { Remove as RemovePost } from "../Store/Posts.ts";
import { CloseAll } from "../Auth/Session.ts";

export type Target = { PostId: string | null; UserId: string | null; MessageId: string | null };

export type Status = "open" | "actioned" | "dismissed";

export type Category = "ai" | "spam" | "harassment" | "adult" | "other";

export function Submit(ReporterId: string, Target: Target, Category: Category, Reason: string) {
  let Evidence: string | null = null;
  if (Target.PostId) {
    const Post = Database.select().from(Posts).where(eq(Posts.Id, Target.PostId)).get();
    if (!Post || Post.DeletedAt) throw new Fail(404, "Post not found");
  } else if (Target.UserId) {
    if (Target.UserId === ReporterId || !ById(Target.UserId)) throw new Fail(404, "User not found");
  } else if (Target.MessageId) {
    const Message = Database.select().from(Messages).where(eq(Messages.Id, Target.MessageId)).get();
    const Member = Message && Database
      .select()
      .from(Participants)
      .where(and(eq(Participants.ConversationId, Message.ConversationId), eq(Participants.UserId, ReporterId)))
      .get();
    if (!Message || !Member || Message.DeletedAt) throw new Fail(404, "Message not found");
    const Files = Database.select({ Name: Attachments.Name, Hash: Attachments.Hash }).from(Attachments).where(eq(Attachments.MessageId, Message.Id)).all();
    Evidence = [Message.Body, Files.length > 0 ? `[attachments: ${Files.map((File) => File.Name ?? File.Hash.slice(0, 8)).join(", ")}]` : ""].filter(Boolean).join("\n");
  }

  const Same = Database
    .select()
    .from(Reports)
    .where(and(
      eq(Reports.ReporterId, ReporterId),
      eq(Reports.Status, "open"),
      Target.PostId ? eq(Reports.PostId, Target.PostId) : undefined,
      Target.UserId ? eq(Reports.UserId, Target.UserId) : undefined,
      Target.MessageId ? eq(Reports.MessageId, Target.MessageId) : undefined,
    ))
    .get();
  if (Same) throw new Fail(409, "Already reported");

  const Row = { Id: Id(), ReporterId, ...Target, Category, Reason, Evidence, Status: "open" as const, ResolverId: null, CreatedAt: new Date() };
  Database.insert(Reports).values(Row).run();
  return { Id: Row.Id, Status: Row.Status, CreatedAt: Row.CreatedAt };
}

function Subject(Row: typeof Reports.$inferSelect) {
  if (Row.PostId) {
    const Post = Database.select().from(Posts).where(eq(Posts.Id, Row.PostId)).get();
    const Author = Post ? ById(Post.AuthorId) : null;
    return { Kind: "post" as const, Id: Row.PostId, Title: Post?.Title ?? null, Body: Post?.Body ?? "", Removed: Boolean(Post?.DeletedAt), Author: Author ? Public(Author) : null };
  }
  if (Row.MessageId) {
    const Message = Database.select().from(Messages).where(eq(Messages.Id, Row.MessageId)).get();
    const Sender = Message?.SenderId ? ById(Message.SenderId) : null;
    return { Kind: "message" as const, Id: Row.MessageId, Body: Message?.DeletedAt ? (Row.Evidence ?? "") : (Message?.Body ?? Row.Evidence ?? ""), Deleted: Boolean(Message?.DeletedAt), Author: Sender ? Public(Sender) : null };
  }
  const Reported = Row.UserId ? ById(Row.UserId) : null;
  return { Kind: "user" as const, Id: Row.UserId!, Author: Reported ? Public(Reported) : null };
}

export function Queue(Status: Status, Before: string | undefined, Limit: number) {
  const Rows = Database
    .select()
    .from(Reports)
    .where(and(eq(Reports.Status, Status), Before ? lt(Reports.Id, Before) : undefined))
    .orderBy(desc(Reports.Id))
    .limit(Limit + 1)
    .all();
  const Page = Rows.slice(0, Limit);
  return {
    Reports: Page.map((Row) => {
      const Reporter = Row.ReporterId ? ById(Row.ReporterId) : null;
      return { Id: Row.Id, Category: Row.Category, Reason: Row.Reason, Status: Row.Status, CreatedAt: Row.CreatedAt, Reporter: Reporter ? Public(Reporter) : null, Subject: Subject(Row) };
    }),
    Next: Rows.length > Limit ? Page.at(-1)!.Id : null,
  };
}

export function Restrict(Actor: { Id: string; Role: string }, TargetId: string, On: boolean) {
  const Target = ById(TargetId);
  if (!Target) throw new Fail(404, "User not found");
  if (Target.Id === Actor.Id) throw new Fail(403, "Cannot suspend yourself");
  if (Target.Role === "admin" || (Target.Role === "mod" && Actor.Role !== "admin")) throw new Fail(403, "Not allowed");
  Suspend(Target.Id, On);
  if (On) CloseAll(Target.Id);
}

export function Resolve(Actor: { Id: string; Role: string }, ReportId: string, Input: { Status: "actioned" | "dismissed"; Remove: boolean; Suspend: boolean }) {
  const Row = Database.select().from(Reports).where(eq(Reports.Id, ReportId)).get();
  if (!Row) throw new Fail(404, "Report not found");
  if (Row.Status !== "open") throw new Fail(409, "Already resolved");

  if (Input.Status === "actioned") {
    if (Input.Remove && Row.PostId) RemovePost(Row.PostId);
    if (Input.Suspend) {
      const Subject = Row.UserId
        ?? (Row.PostId ? Database.select().from(Posts).where(eq(Posts.Id, Row.PostId)).get()?.AuthorId : null)
        ?? (Row.MessageId ? Database.select().from(Messages).where(eq(Messages.Id, Row.MessageId)).get()?.SenderId : null);
      if (Subject) Restrict(Actor, Subject, true);
    }
  }

  Database.update(Reports).set({ Status: Input.Status, ResolverId: Actor.Id }).where(eq(Reports.Id, ReportId)).run();
  return { Id: ReportId, Status: Input.Status };
}
