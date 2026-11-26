import { Hono, type Context } from "hono";
import { Fail } from "../Store/Fail.ts";
import { Bucket } from "../Shield/Bucket.ts";
import * as Hub from "../Live/Hub.ts";
import { upgradeWebSocket } from "../Live/Socket.ts";
import { Totals } from "../Messages/Inbox.ts";
import { Need, type Env } from "./Context.ts";

export const Live = new Hono<Env>();

function Same(c: Context<Env>) {
  const Origin = c.req.header("origin");
  if (!Origin) return;
  try {
    if (new URL(Origin).host === c.req.header("host")) return;
  } catch {}
  throw new Fail(403, "Bad origin");
}

Live.get(
  "/",
  (c, next) => {
    Need(c);
    Same(c);
    return next();
  },
  upgradeWebSocket((c) => {
    const Viewer = c.get("Viewer")!;
    const Pace = Bucket({ Burst: 20, Refill: 5 });
    const Entry: Hub.Entry = { Token: c.get("Token")!, Send: () => {}, Close: () => {} };

    return {
      onOpen(_event, ws) {
        Entry.Send = (Text) => ws.send(Text);
        Entry.Close = (Code, Reason) => ws.close(Code, Reason);
        Hub.Join(Viewer.Id, Entry);
        ws.send(JSON.stringify({ Type: "Ready", ...Totals(Viewer.Id) }));
      },

      onMessage(event, ws) {
        if (!Pace.Take("socket")) {
          ws.close(1008, "Too fast");
          return;
        }
        if (typeof event.data !== "string" || event.data.length > 256) return;
        try {
          if (JSON.parse(event.data).Type === "Ping") ws.send('{"Type":"Pong"}');
        } catch {}
      },

      onClose() {
        Hub.Leave(Viewer.Id, Entry);
      },
    };
  }),
);
