import type { Context, MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import * as Session from "../Auth/Session.ts";
import { Fail } from "../Store/Fail.ts";

export type Viewer = { Id: string; Username: string; Role: "member" | "mod" | "admin" };

export type Env = { Variables: { Viewer: Viewer | null; Token: string | null } };

export const Cookie = "Session";

export const Identify: MiddlewareHandler<Env> = async (c, next) => {
  const Token = getCookie(c, Cookie) ?? null;
  c.set("Token", Token);
  c.set("Viewer", Token ? Session.Read(Token) : null);
  await next();
};

export function Need(c: Context<Env>) {
  const Viewer = c.get("Viewer");
  if (!Viewer) throw new Fail(401, "Sign in required");
  return Viewer;
}

export function Staff(c: Context<Env>) {
  const Viewer = Need(c);
  if (Viewer.Role === "member") throw new Fail(403, "Forbidden");
  return Viewer;
}

export function Admin(c: Context<Env>) {
  const Viewer = Need(c);
  if (Viewer.Role !== "admin") throw new Fail(403, "Forbidden");
  return Viewer;
}
