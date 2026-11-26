import { desc, eq, like } from "drizzle-orm";
import { Database } from "../Store/Database.ts";
import { Bans } from "../Store/Schema.ts";

export function Add(Print: string, Reason: string, Hours: number | null) {
  const ExpiresAt = Hours === null ? null : new Date(Date.now() + Hours * 3_600_000);
  Database
    .insert(Bans)
    .values({ Fingerprint: Print, Reason, ExpiresAt, CreatedAt: new Date() })
    .onConflictDoUpdate({ target: Bans.Fingerprint, set: { Reason, ExpiresAt } })
    .run();
  console.log(`[shield] ban ${Print.slice(0, 12)}: ${Reason}`);
}

export function Has(Print: string) {
  const Row = Database.select().from(Bans).where(eq(Bans.Fingerprint, Print)).get();
  if (!Row) return false;
  if (Row.ExpiresAt && Row.ExpiresAt < new Date()) {
    Database.delete(Bans).where(eq(Bans.Fingerprint, Print)).run();
    return false;
  }
  return true;
}

export function List() {
  return Database.select().from(Bans).orderBy(desc(Bans.CreatedAt)).limit(200).all().map((Row) => ({
    Ref: Row.Fingerprint.slice(0, 12),
    Reason: Row.Reason,
    ExpiresAt: Row.ExpiresAt,
    CreatedAt: Row.CreatedAt,
  }));
}

export function Lift(Ref: string) {
  return Database.delete(Bans).where(like(Bans.Fingerprint, `${Ref}%`)).returning({ Id: Bans.Fingerprint }).all().length;
}
