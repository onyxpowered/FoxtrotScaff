import { App } from "./App.ts";
import { Bootstrap } from "./Invites/Invites.ts";
import { Read, Sweep } from "./Auth/Session.ts";
import { Audit } from "./Live/Hub.ts";
import { Config } from "./Live/Socket.ts";

Bootstrap();
setInterval(Sweep, 60 * 60 * 1000).unref();
setInterval(() => Audit((Token) => Read(Token) !== null), 5 * 60 * 1000).unref();

export default {
  port: Number(process.env.PORT ?? 3001),
  hostname: process.env.HOST ?? "127.0.0.1",
  fetch: App.fetch,
  websocket: Config,
};
