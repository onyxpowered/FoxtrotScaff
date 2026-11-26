import { Hono, type Context } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import { Register } from "../Auth/Register.ts";
import { Login, Change, Erase } from "../Auth/Login.ts";
import * as Session from "../Auth/Session.ts";
import * as Preferences from "../Store/Preferences.ts";
import * as Notifications from "../Store/Notifications.ts";
import { Totals } from "../Messages/Inbox.ts";
import { ById, Public } from "../Store/Users.ts";
import { Cookie, Need, type Env } from "./Context.ts";
import { Json } from "./Parse.ts";
import { Limit } from "./Limit.ts";

export const Auth = new Hono<Env>();

const Username = z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/, "3-24 letters, numbers or underscores");
const Secret = z.string().min(10, "At least 10 characters").max(200);

function Issue(c: Context, Opened: { Token: string; ExpiresAt: Date }) {
  setCookie(c, Cookie, Opened.Token, {
    httpOnly: true,
    sameSite: "Lax",
    secure: process.env.COOKIE_SECURE === "1",
    path: "/",
    expires: Opened.ExpiresAt,
  });
}

Auth.post("/register", Limit(20, 60_000), async (c) => {
  const Input = await Json(c, z.object({ Username, Display: z.string().trim().min(1).max(40), Password: Secret, Invite: z.string().trim().min(1).max(40), Pledge: z.literal(true, { error: "You must agree to the human-made pledge" }) }));
  const Done = await Register(Input);
  Issue(c, Done.Session);
  return c.json({ User: Done.User }, 201);
});

Auth.post("/login", Limit(20, 60_000), async (c) => {
  const Input = await Json(c, z.object({ Username, Password: z.string().min(1).max(200) }));
  const Done = await Login(Input.Username, Input.Password);
  Issue(c, Done.Session);
  return c.json({ User: Done.User });
});

Auth.post("/logout", (c) => {
  const Token = c.get("Token");
  if (Token) Session.Close(Token);
  deleteCookie(c, Cookie, { path: "/" });
  return c.body(null, 204);
});

Auth.get("/me", (c) => {
  const Viewer = Need(c);
  return c.json({
    User: Public(ById(Viewer.Id)!),
    Preferences: Preferences.Get(Viewer.Id),
    Unread: Notifications.Unread(Viewer.Id),
    Messages: Totals(Viewer.Id),
  });
});

Auth.post("/password", Limit(10, 60_000), async (c) => {
  const Viewer = Need(c);
  const Input = await Json(c, z.object({ Current: z.string().min(1).max(200), Next: Secret }));
  Issue(c, await Change(Viewer.Id, Input.Current, Input.Next));
  return c.body(null, 204);
});

Auth.delete("/account", Limit(5, 60_000), async (c) => {
  const Viewer = Need(c);
  const Input = await Json(c, z.object({ Password: z.string().min(1).max(200) }));
  await Erase(Viewer.Id, Input.Password);
  deleteCookie(c, Cookie, { path: "/" });
  return c.body(null, 204);
});
