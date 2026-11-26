import { Hono } from "hono";
import { z } from "zod";
import * as Feed from "../Feeds/Feeds.ts";
import { Need, type Env } from "./Context.ts";
import { Paging, Query, Value } from "./Parse.ts";

export const Feeds = new Hono<Env>();

Feeds.get("/home", (c) => {
  const Viewer = Need(c);
  const Input = Query(c, Paging);
  return c.json(Feed.Home(Viewer.Id, Input.Before, Input.Limit));
});

Feeds.get("/recent", (c) => {
  const Viewer = Need(c);
  const Input = Query(c, Paging);
  return c.json(Feed.Recent(Viewer.Id, Input.Before, Input.Limit));
});

Feeds.get("/gallery", (c) => {
  const Viewer = Need(c);
  const Input = Query(c, Paging);
  return c.json(Feed.Gallery(Viewer.Id, Input.Before, Input.Limit));
});

Feeds.get("/nearby", (c) => {
  const Viewer = Need(c);
  const Input = Query(c, Paging);
  return c.json(Feed.Nearby(Viewer.Id, Input.Before, Input.Limit));
});

Feeds.get("/tag/:Name", (c) => {
  const Viewer = Need(c);
  const Input = Query(c, Paging);
  const Name = Value(z.string().trim().toLowerCase().regex(/^[a-z0-9_-]{1,32}$/, "Tags are 1-32 letters, numbers, - or _"), decodeURIComponent(c.req.param("Name")).replace(/^#/, ""));
  return c.json(Feed.Tag(Viewer.Id, Name, Input.Before, Input.Limit));
});
