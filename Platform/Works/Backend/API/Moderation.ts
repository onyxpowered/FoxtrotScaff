import { Hono } from "hono";
import { z } from "zod";
import * as Reports from "../Moderation/Reports.ts";
import { ByUsername } from "../Store/Users.ts";
import { Fail } from "../Store/Fail.ts";
import * as Bans from "../Shield/Bans.ts";
import { Admin, Need, Staff, type Env } from "./Context.ts";
import { Json, Paging, Query } from "./Parse.ts";
import { Limit } from "./Limit.ts";

export const Report = new Hono<Env>();

Report.post("/", Limit(10, 60_000), async (c) => {
  const Viewer = Need(c);
  const Input = await Json(c, z.object({
    PostId: z.string().max(64).nullish().transform((Value) => Value ?? null),
    UserId: z.string().max(64).nullish().transform((Value) => Value ?? null),
    MessageId: z.string().max(64).nullish().transform((Value) => Value ?? null),
    Category: z.enum(["ai", "spam", "harassment", "adult", "other"]).default("other"),
    Reason: z.string().trim().min(3, "Say what is wrong").max(1000),
  }));
  const Named = [Input.PostId, Input.UserId, Input.MessageId].filter(Boolean).length;
  if (Named !== 1) throw new Fail(400, "Report exactly one post, user or message");
  const { Reason, Category, ...Target } = Input;
  return c.json(Reports.Submit(Viewer.Id, Target, Category, Reason), 201);
});

export const Moderation = new Hono<Env>();

Moderation.get("/reports", (c) => {
  Staff(c);
  const Input = Query(c, z.object({ Status: z.enum(["open", "actioned", "dismissed"]).default("open"), Before: Paging.shape.Before, Limit: Paging.shape.Limit }));
  return c.json(Reports.Queue(Input.Status, Input.Before, Input.Limit));
});

Moderation.post("/reports/:Id", async (c) => {
  const Viewer = Staff(c);
  const Input = await Json(c, z.object({
    Status: z.enum(["actioned", "dismissed"]),
    Remove: z.boolean().default(false),
    Suspend: z.boolean().default(false),
  }));
  return c.json(Reports.Resolve(Viewer, c.req.param("Id"), Input));
});

Moderation.put("/users/:Username", async (c) => {
  const Viewer = Staff(c);
  const Input = await Json(c, z.object({ Suspended: z.boolean() }));
  const Target = ByUsername(c.req.param("Username"));
  if (!Target) throw new Fail(404, "User not found");
  Reports.Restrict(Viewer, Target.Id, Input.Suspended);
  return c.body(null, 204);
});

Moderation.get("/bans", (c) => {
  Admin(c);
  return c.json(Bans.List());
});

Moderation.delete("/bans/:Ref", (c) => {
  Admin(c);
  const Ref = c.req.param("Ref");
  if (!/^[a-f0-9]{8,64}$/.test(Ref)) throw new Fail(400, "Bad reference");
  if (Bans.Lift(Ref) === 0) throw new Fail(404, "No such ban");
  return c.body(null, 204);
});
