import { Hono } from "hono";
import * as Store from "../Invites/Invites.ts";
import { Need, type Env } from "./Context.ts";

export const Invites = new Hono<Env>();

Invites.get("/", (c) => c.json(Store.Mine(Need(c).Id)));

Invites.post("/", (c) => {
  const Row = Store.Create(Need(c));
  return c.json({ Code: Row.Code, CreatedAt: Row.CreatedAt }, 201);
});
