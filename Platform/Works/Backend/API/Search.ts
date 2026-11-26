import { Hono } from "hono";
import { z } from "zod";
import { ForPosts, ForUsers } from "../Store/Search.ts";
import { Need, type Env } from "./Context.ts";
import { Query } from "./Parse.ts";

export const Search = new Hono<Env>();

Search.get("/", (c) => {
  const Viewer = Need(c);
  const Input = Query(c, z.object({
    Q: z.string().trim().min(1).max(100),
    Kind: z.enum(["posts", "users"]).default("posts"),
    Limit: z.coerce.number().int().min(1).max(50).default(30),
  }));
  return c.json(Input.Kind === "posts" ? { Posts: ForPosts(Input.Q, Viewer.Id, Input.Limit) } : { Users: ForUsers(Input.Q, Viewer.Id, Input.Limit) });
});
