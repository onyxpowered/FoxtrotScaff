import type { MiddlewareHandler } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { Load } from "../Store/Keys.ts";
import { Fingerprint, Read } from "./Fingerprint.ts";
import { Score, Thresholds } from "./Signals.ts";
import { Bucket } from "./Bucket.ts";
import * as Work from "./Work.ts";
import * as Maze from "./Maze.ts";
import * as Bans from "./Bans.ts";
import { Traps } from "./Robots.ts";

export const Verify = "/_shield/verify";

const Free = new Set(["/health", "/robots.txt"]);
const Mazes = 40;

export type Settings = {
  Off: boolean;
  Secret: Buffer;
  Burst: number;
  Refill: number;
  MediaBurst: number;
  MediaRefill: number;
  Difficulty: number;
  PassTtl: number;
  Allow: string[];
  Traps: readonly string[];
  Secure: boolean;
};

export function Defaults(): Settings {
  return {
    Off: process.env.SHIELD === "off",
    Secret: Load("Shield", "SHIELD_SECRET"),
    Burst: Number(process.env.SHIELD_BURST ?? 120),
    Refill: Number(process.env.SHIELD_REFILL ?? 4),
    MediaBurst: Number(process.env.SHIELD_MEDIA_BURST ?? 400),
    MediaRefill: Number(process.env.SHIELD_MEDIA_REFILL ?? 30),
    Difficulty: Number(process.env.SHIELD_DIFFICULTY ?? 4),
    PassTtl: 30 * 60_000,
    Allow: (process.env.SHIELD_ALLOW ?? "").split(",").map((Ip) => Ip.trim()).filter(Boolean),
    Traps,
    Secure: process.env.COOKIE_SECURE === "1",
  };
}

export function Guard(Config: Settings): MiddlewareHandler {
  const Trapped = new Set(Config.Traps);
  const Allowed = new Set(Config.Allow);
  const Api = Bucket({ Burst: Config.Burst, Refill: Config.Refill });
  const Media = Bucket({ Burst: Config.MediaBurst, Refill: Config.MediaRefill });
  let Digging = 0;

  setInterval(() => {
    Api.Sweep(30 * 60_000);
    Media.Sweep(30 * 60_000);
  }, 10 * 60_000).unref();

  function Dig(Print: string) {
    if (Digging >= Mazes) return new Response(null, { status: 403 });
    Digging += 1;
    return Maze.Stream(Print, () => {
      Digging -= 1;
    });
  }

  return async (c, next) => {
    if (Config.Off) return next();

    const Seen = Read(c);
    if (Free.has(Seen.Path) || Allowed.has(Seen.Ip)) return next();

    const Print = Fingerprint(Seen);

    if (Trapped.has(Seen.Path) || Seen.Path.startsWith("/archive/")) {
      if (!Bans.Has(Print)) Bans.Add(Print, `entered trap ${Seen.Path}`, null);
      return Dig(Print);
    }

    if (Bans.Has(Print)) return c.json({ Error: "Access blocked", Ref: Print.slice(0, 12) }, 403);

    const Heavy = Seen.Path.startsWith("/media/");
    if (!(Heavy ? Media : Api).Take(Print)) {
      c.header("Retry-After", "5");
      return c.json({ Error: "Too many requests, slow down" }, 429);
    }

    if (Seen.Method === "POST" && Seen.Path === Verify) {
      if (Number(c.req.header("content-length") ?? 0) > 2000) return c.json({ Error: "Payload too large" }, 413);
      const Body = await c.req.json().catch(() => null);
      const Valid = typeof Body?.Challenge === "string" && typeof Body?.Solution === "string" && Work.Solves(Config.Secret, Body.Challenge, Print, Body.Solution);
      if (!Valid) return c.json({ Error: "Invalid or expired challenge solution" }, 403);
      setCookie(c, "shield_pass", Work.Pass(Config.Secret, Print, Config.PassTtl), {
        httpOnly: true,
        sameSite: "Strict",
        secure: Config.Secure,
        path: "/",
        maxAge: Math.floor(Config.PassTtl / 1000),
      });
      return c.json({ Ok: true });
    }

    const Verdict = Score(Seen);

    if (Verdict.Total >= Thresholds.Block) {
      Bans.Add(Print, `bot score ${Verdict.Total}: ${Verdict.Reasons.join(", ")}`, 24);
      return c.json({ Error: "Access blocked", Ref: Print.slice(0, 12) }, 403);
    }

    if (Verdict.Total >= Thresholds.Challenge) {
      const Token = c.req.header("x-shield-pass") ?? getCookie(c, "shield_pass");
      if (Token && Work.Passes(Config.Secret, Token, Print)) return next();
      const Puzzle = Work.Issue(Config.Secret, Print, Config.Difficulty);
      return c.json({ Challenge: Puzzle.Challenge, Nonce: Puzzle.Nonce, Difficulty: Puzzle.Difficulty, Verify }, 401);
    }

    return next();
  };
}
