import { createHash } from "node:crypto";
import type { Context } from "hono";
import { getConnInfo } from "hono/bun";

export type Signals = {
  Ip: string;
  Method: string;
  Path: string;
  Agent: string;
  Language: string;
  Encoding: string;
  Accept: string;
};

export function Address(c: Context) {
  if (process.env.TRUST_PROXY === "1") return c.req.header("cf-connecting-ip") ?? "proxy";
  try {
    return getConnInfo(c).remote.address ?? "local";
  } catch {
    return "local";
  }
}

export function Read(c: Context): Signals {
  return {
    Ip: Address(c),
    Method: c.req.method,
    Path: c.req.path.toLowerCase().replace(/\/+$/, "") || "/",
    Agent: c.req.header("user-agent") ?? "",
    Language: c.req.header("accept-language") ?? "",
    Encoding: c.req.header("accept-encoding") ?? "",
    Accept: c.req.header("accept") ?? "",
  };
}

export function Fingerprint(Seen: Pick<Signals, "Ip" | "Agent" | "Language" | "Encoding">) {
  return createHash("sha256").update([Seen.Ip, Seen.Agent, Seen.Language, Seen.Encoding].join("|")).digest("hex");
}
