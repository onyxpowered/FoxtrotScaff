import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { Fail } from "./Store/Fail.ts";
import { Largest } from "./Media/Types.ts";
import { Identify, type Env } from "./API/Context.ts";
import { Headers } from "./API/Headers.ts";
import { Guard, Defaults } from "./Shield/Guard.ts";
import { Text as Robots } from "./Shield/Robots.ts";
import { Auth } from "./API/Auth.ts";
import { Users } from "./API/Users.ts";
import { Posts } from "./API/Posts.ts";
import { Feeds } from "./API/Feeds.ts";
import { Search } from "./API/Search.ts";
import { Conversations } from "./API/Conversations.ts";
import { Live } from "./API/Live.ts";
import { Notifications } from "./API/Notifications.ts";
import { Invites } from "./API/Invites.ts";
import { Media, Serve } from "./API/Media.ts";
import { Report, Moderation } from "./API/Moderation.ts";
import { Connections, Crossposts } from "./API/Connections.ts";

export const App = new Hono<Env>();

const Small = bodyLimit({ maxSize: 1_000_000, onError: (c) => c.json({ Error: "Payload too large" }, 413) });
const Large = bodyLimit({ maxSize: Largest + 1_000_000, onError: (c) => c.json({ Error: "Payload too large" }, 413) });

App.use(Headers);
App.use(Guard(Defaults()));

App.onError((Err, c) => {
  if (Err instanceof Fail) return c.json({ Error: Err.message }, Err.Status as ContentfulStatusCode);
  console.error(Err);
  return c.json({ Error: "Something went wrong" }, 500);
});

App.notFound((c) => c.json({ Error: "Not found" }, 404));

App.get("/health", (c) => c.json({ Ok: true }));
App.get("/robots.txt", (c) => c.text(Robots()));

App.use("/api/*", Identify);
App.use("/api/*", (c, next) => (c.req.path.startsWith("/api/media") ? Large(c, next) : Small(c, next)));
App.use("/media/*", Identify);

App.route("/api/auth", Auth);
App.route("/api/users", Users);
App.route("/api/posts", Posts);
App.route("/api/feeds", Feeds);
App.route("/api/search", Search);
App.route("/api/conversations", Conversations);
App.route("/api/live", Live);
App.route("/api/notifications", Notifications);
App.route("/api/invites", Invites);
App.route("/api/media", Media);
App.route("/api/reports", Report);
App.route("/api/moderation", Moderation);
App.route("/api/connections", Connections);
App.route("/api/crossposts", Crossposts);

App.get("/media/:Hash", Serve);
