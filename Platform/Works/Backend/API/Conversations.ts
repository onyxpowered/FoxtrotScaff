import { Hono } from "hono";
import { z } from "zod";
import * as Chat from "../Messages/Messages.ts";
import * as Box from "../Messages/Inbox.ts";
import * as Hub from "../Live/Hub.ts";
import { Need, type Env } from "./Context.ts";
import { Json, Paging, Query } from "./Parse.ts";
import { Limit } from "./Limit.ts";

export const Conversations = new Hono<Env>();

const Text = z.string().max(4000);

const Compose = z.object({
  Body: Text.default(""),
  Attachments: z.array(z.object({
    Hash: z.string().regex(/^[a-f0-9]{64}$/),
    Name: z.string().trim().max(200).nullish().transform((Value) => Value || null),
    Alt: z.string().trim().max(500).nullish().transform((Value) => Value || null),
  })).max(10).default([]),
  ReplyId: z.string().max(64).nullish().transform((Value) => Value || null),
});

type Outcome = { ConversationId: string; MessageId: string; Recipient: string };

function Announce(Type: "Message" | "Edited" | "Reaction", Outcome: Outcome, Actor: string) {
  for (const Person of [Actor, Outcome.Recipient]) {
    Hub.Push(Person, {
      Type,
      ConversationId: Outcome.ConversationId,
      State: Box.StateOf(Outcome.ConversationId, Person),
      Message: Chat.View(Outcome.MessageId, Person),
    });
  }
  if (Type === "Message") Hub.Push(Outcome.Recipient, { Type: "Unread", ...Box.Totals(Outcome.Recipient) });
}

function Sync(UserId: string) {
  Hub.Push(UserId, { Type: "Unread", ...Box.Totals(UserId) });
}

Conversations.get("/", (c) => {
  const Viewer = Need(c);
  const Input = Query(c, z.object({ Section: z.enum(["active", "request", "muted"]).default("active") }));
  return c.json(Box.Inbox(Viewer.Id, Input.Section));
});

Conversations.get("/unread", (c) => c.json(Box.Totals(Need(c).Id)));

Conversations.post("/", Limit(30, 60_000), async (c) => {
  const Viewer = Need(c);
  const Input = await Json(c, Compose.extend({ To: z.string().trim().toLowerCase().max(24) }));
  const Outcome = Chat.Send(Viewer.Id, Input.To, Input);
  Announce("Message", Outcome, Viewer.Id);
  return c.json({ ConversationId: Outcome.ConversationId, Message: Chat.View(Outcome.MessageId, Viewer.Id) }, 201);
});

Conversations.get("/:Id", (c) => {
  const Viewer = Need(c);
  const Input = Query(c, Paging);
  return c.json(Box.Thread(c.req.param("Id"), Viewer.Id, Input.Before, Input.Limit));
});

Conversations.post("/:Id", Limit(60, 60_000), async (c) => {
  const Viewer = Need(c);
  const Input = await Json(c, Compose);
  const Outcome = Chat.Reply(c.req.param("Id"), Viewer.Id, Input);
  Announce("Message", Outcome, Viewer.Id);
  return c.json(Chat.View(Outcome.MessageId, Viewer.Id), 201);
});

Conversations.patch("/:Id", async (c) => {
  const Viewer = Need(c);
  const Input = await Json(c, z.object({ State: z.enum(["active", "muted"]) }));
  Box.Mark(c.req.param("Id"), Viewer.Id, Input.State);
  Sync(Viewer.Id);
  return c.body(null, 204);
});

Conversations.post("/:Id/read", (c) => {
  const Viewer = Need(c);
  Box.Read(c.req.param("Id"), Viewer.Id);
  Sync(Viewer.Id);
  return c.body(null, 204);
});

Conversations.delete("/:Id", (c) => {
  const Viewer = Need(c);
  Box.Clear(c.req.param("Id"), Viewer.Id);
  Hub.Push(Viewer.Id, { Type: "Cleared", ConversationId: c.req.param("Id") });
  Sync(Viewer.Id);
  return c.body(null, 204);
});

Conversations.patch("/:Id/messages/:MessageId", Limit(60, 60_000), async (c) => {
  const Viewer = Need(c);
  const Input = await Json(c, z.object({ Body: Text }));
  const Outcome = Chat.Edit(c.req.param("Id"), c.req.param("MessageId"), Viewer.Id, Input.Body);
  Announce("Edited", Outcome, Viewer.Id);
  return c.json(Chat.View(Outcome.MessageId, Viewer.Id));
});

Conversations.delete("/:Id/messages/:MessageId", (c) => {
  const Viewer = Need(c);
  const Outcome = Chat.Remove(c.req.param("Id"), c.req.param("MessageId"), Viewer.Id);
  for (const Person of [Viewer.Id, Outcome.Recipient]) {
    Hub.Push(Person, { Type: "Deleted", ConversationId: Outcome.ConversationId, MessageId: Outcome.MessageId });
  }
  Sync(Outcome.Recipient);
  return c.body(null, 204);
});

Conversations.put("/:Id/messages/:MessageId/reactions/:Emoji", Limit(120, 60_000), (c) => {
  const Viewer = Need(c);
  const Outcome = Chat.React(c.req.param("Id"), c.req.param("MessageId"), Viewer.Id, decodeURIComponent(c.req.param("Emoji")));
  Announce("Reaction", Outcome, Viewer.Id);
  return c.json(Chat.View(Outcome.MessageId, Viewer.Id));
});

Conversations.delete("/:Id/messages/:MessageId/reactions/:Emoji", Limit(120, 60_000), (c) => {
  const Viewer = Need(c);
  const Outcome = Chat.Unreact(c.req.param("Id"), c.req.param("MessageId"), Viewer.Id, decodeURIComponent(c.req.param("Emoji")));
  Announce("Reaction", Outcome, Viewer.Id);
  return c.json(Chat.View(Outcome.MessageId, Viewer.Id));
});
