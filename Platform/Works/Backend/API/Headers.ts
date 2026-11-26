import type { MiddlewareHandler } from "hono";

const Fixed: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Permissions-Policy": "geolocation=(), camera=(), microphone=(), interest-cohort=()",
  "X-Robots-Tag": "noindex, noarchive, noai, noimageai",
  "TDM-Reservation": "1",
  "Cache-Control": "no-store",
};

export const Headers: MiddlewareHandler = async (c, next) => {
  await next();
  for (const [Name, Value] of Object.entries(Fixed)) {
    if (!c.res.headers.has(Name)) c.res.headers.set(Name, Value);
  }
  if (!c.res.headers.has("Content-Security-Policy")) {
    c.res.headers.set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
  }
};
