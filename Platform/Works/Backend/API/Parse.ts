import type { Context } from "hono";
import { z } from "zod";
import { Fail } from "../Store/Fail.ts";

export const Rating = z.enum(["safe", "mature", "adult"]);

export const Paging = z.object({
  Before: z.string().max(64).optional(),
  Limit: z.coerce.number().int().min(1).max(50).default(30),
});

export function Value<S extends z.ZodType>(Shape: S, Input: unknown): z.infer<S> {
  const Result = Shape.safeParse(Input);
  if (Result.success) return Result.data;
  const Issue = Result.error.issues[0];
  const Where = Issue?.path.join(".");
  throw new Fail(400, Where ? `${Where}: ${Issue.message}` : (Issue?.message ?? "Invalid request"));
}

export async function Json<S extends z.ZodType>(c: Context, Shape: S) {
  return Value(Shape, await c.req.json().catch(() => null));
}

export function Query<S extends z.ZodType>(c: Context, Shape: S) {
  return Value(Shape, c.req.query());
}
