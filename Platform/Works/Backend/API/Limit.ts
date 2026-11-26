import type { MiddlewareHandler } from "hono";
import { Address } from "../Shield/Fingerprint.ts";
import { Fail } from "../Store/Fail.ts";

export function Limit(Max: number, Window: number): MiddlewareHandler {
  const Hits = new Map<string, number[]>();

  setInterval(() => {
    const Cutoff = Date.now() - Window;
    for (const [Key, Times] of Hits) {
      const Recent = Times.filter((Time) => Time > Cutoff);
      if (Recent.length > 0) Hits.set(Key, Recent);
      else Hits.delete(Key);
    }
  }, Window).unref();

  return async (c, next) => {
    const Key = Address(c);
    const Cutoff = Date.now() - Window;
    const Recent = (Hits.get(Key) ?? []).filter((Time) => Time > Cutoff);
    if (Recent.length >= Max) throw new Fail(429, "Too many requests, slow down");
    Recent.push(Date.now());
    Hits.set(Key, Recent);
    await next();
  };
}
