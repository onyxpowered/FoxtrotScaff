import { Hono } from "hono";
import * as Store from "../Store/Notifications.ts";
import { Need, type Env } from "./Context.ts";
import { Paging, Query } from "./Parse.ts";

export const Notifications = new Hono<Env>();

Notifications.get("/", (c) => {
  const Viewer = Need(c);
  const Input = Query(c, Paging);
  return c.json({ ...Store.List(Viewer.Id, Input.Before, Input.Limit), Unread: Store.Unread(Viewer.Id) });
});

Notifications.post("/read", (c) => {
  Store.Clear(Need(c).Id);
  return c.body(null, 204);
});
