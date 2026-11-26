import { Hono } from "hono";
import { z } from "zod";
import * as Store from "../Store/Connections.ts";
import { Fail } from "../Store/Fail.ts";
import { Need, type Env } from "./Context.ts";
import { Json } from "./Parse.ts";

export const Connections = new Hono<Env>();

Connections.get("/", (c) => c.json(Store.List(Need(c).Id)));

Connections.post("/", async (c) => {
  const Viewer = Need(c);
  const Input = await Json(c, z.object({
    Platform: z.string().trim().toLowerCase().regex(/^[a-z0-9_.-]{2,32}$/),
    Handle: z.string().trim().min(1).max(100),
    Mode: z.enum(["oauth", "session"]),
    Secret: z.string().max(4000).nullish().transform((Value) => Value || null),
  }));
  return c.json(Store.Link(Viewer.Id, Input), 201);
});

Connections.delete("/:Id", (c) => {
  if (!Store.Unlink(Need(c).Id, c.req.param("Id"))) throw new Fail(404, "Connection not found");
  return c.body(null, 204);
});

export const Crossposts = new Hono<Env>();

Crossposts.post("/", async (c) => {
  const Viewer = Need(c);
  const Input = await Json(c, z.object({ PostId: z.string().max(64), ConnectionId: z.string().max(64) }));
  return c.json(Store.Queue(Viewer.Id, Input.PostId, Input.ConnectionId), 201);
});

Crossposts.patch("/:Id", async (c) => {
  const Viewer = Need(c);
  const Input = await Json(c, z.object({
    Status: z.enum(["queued", "posted", "failed"]),
    RemoteId: z.string().max(200).nullish().transform((Value) => Value ?? null),
    RemoteUrl: z.url({ protocol: /^https?$/ }).max(500).nullish().transform((Value) => Value ?? null),
    Error: z.string().max(1000).nullish().transform((Value) => Value ?? null),
  }));
  return c.json(Store.Report(Viewer.Id, c.req.param("Id"), Input));
});

Crossposts.post("/:Id/snapshots", async (c) => {
  const Viewer = Need(c);
  const Input = await Json(c, z.object({
    Views: z.number().int().min(0).default(0),
    Faves: z.number().int().min(0).default(0),
    Comments: z.number().int().min(0).default(0),
  }));
  return c.json(Store.Snap(Viewer.Id, c.req.param("Id"), Input), 201);
});
