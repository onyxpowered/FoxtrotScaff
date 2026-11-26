import { Hono } from "hono";
import { z } from "zod";
import * as PostStore from "../Store/Posts.ts";
import * as Social from "../Store/Social.ts";
import * as Notifications from "../Store/Notifications.ts";
import * as Connections from "../Store/Connections.ts";
import { Fail } from "../Store/Fail.ts";
import { Need, type Env } from "./Context.ts";
import { Json, Paging, Query, Rating } from "./Parse.ts";
import { Limit } from "./Limit.ts";

export const Posts = new Hono<Env>();

const Tag = z.string().trim().toLowerCase().transform((Value) => Value.replace(/^#/, "")).pipe(z.string().regex(/^[a-z0-9_-]{1,32}$/, "Tags are 1-32 letters, numbers, - or _"));

const Draft = z.object({
  Title: z.string().trim().max(200).nullish().transform((Value) => Value || null),
  Body: z.string().max(5000).default(""),
  Rating: Rating.default("safe"),
  Tags: z.array(Tag).max(20).default([]),
  Media: z.array(z.object({
    Hash: z.string().regex(/^[a-f0-9]{64}$/),
    Alt: z.string().trim().max(500).nullish().transform((Value) => Value || null),
    Name: z.string().trim().max(200).nullish().transform((Value) => Value || null),
  })).max(10).default([]),
  ParentId: z.string().max(64).nullish().transform((Value) => Value || null),
  QuoteId: z.string().max(64).nullish().transform((Value) => Value || null),
  ReplyGate: z.enum(["everyone", "followers", "mutuals", "mentioned", "nobody"]).default("everyone"),
});

Posts.post("/", Limit(30, 60_000), async (c) => {
  const Viewer = Need(c);
  const Input = await Json(c, Draft);
  return c.json(PostStore.Create(Viewer.Id, { ...Input, Tags: [...new Set(Input.Tags)] }), 201);
});

Posts.get("/:Id", (c) => {
  const Viewer = Need(c);
  return c.json(PostStore.Show(c.req.param("Id"), Viewer.Id));
});

Posts.get("/:Id/replies", (c) => {
  const Viewer = Need(c);
  const Input = Query(c, z.object({ After: z.string().max(64).optional(), Limit: Paging.shape.Limit }));
  PostStore.Show(c.req.param("Id"), Viewer.Id);
  return c.json(PostStore.Replies(c.req.param("Id"), Viewer.Id, Input.After, Input.Limit));
});

Posts.delete("/:Id", (c) => {
  const Viewer = Need(c);
  const Post = PostStore.ById(c.req.param("Id"));
  if (!Post || Post.DeletedAt) throw new Fail(404, "Post not found");
  if (Post.AuthorId !== Viewer.Id && Viewer.Role === "member") throw new Fail(403, "Forbidden");
  PostStore.Remove(Post.Id);
  return c.body(null, 204);
});

Posts.post("/:Id/fave", (c) => {
  const Viewer = Need(c);
  const Post = PostStore.Show(c.req.param("Id"), Viewer.Id);
  if (Social.Fave(Viewer.Id, Post.Id)) Notifications.Notify(Post.Author.Id, Viewer.Id, "fave", Post.Id);
  return c.body(null, 204);
});

Posts.delete("/:Id/fave", (c) => {
  const Viewer = Need(c);
  Social.Unfave(Viewer.Id, c.req.param("Id"));
  return c.body(null, 204);
});

Posts.get("/:Id/analytics", (c) => {
  const Viewer = Need(c);
  return c.json(Connections.Analytics(Viewer.Id, c.req.param("Id")));
});
