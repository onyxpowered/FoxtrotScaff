import { eq } from "drizzle-orm";
import { Database } from "./Database.ts";
import { Preferences } from "./Schema.ts";

export type Rating = "safe" | "mature" | "adult";

const Order: Rating[] = ["safe", "mature", "adult"];

export function Allowed(Max: Rating) {
  return Order.slice(0, Order.indexOf(Max) + 1);
}

export function Get(UserId: string) {
  return Database.select().from(Preferences).where(eq(Preferences.UserId, UserId)).get() ?? { UserId, MaxRating: "safe" as Rating };
}

export function Set(UserId: string, MaxRating: Rating) {
  Database
    .insert(Preferences)
    .values({ UserId, MaxRating })
    .onConflictDoUpdate({ target: Preferences.UserId, set: { MaxRating } })
    .run();
  return Get(UserId);
}
