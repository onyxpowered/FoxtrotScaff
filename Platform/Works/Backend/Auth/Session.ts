import { eq, lt } from "drizzle-orm";
import { Database } from "../Store/Database.ts";
import { Sessions, Users } from "../Store/Schema.ts";
import { Id } from "../Store/Id.ts";
import { Drop, Revoke } from "../Live/Hub.ts";

const Lifetime = 30 * 24 * 60 * 60 * 1000;

function Digest(Token: string) {
  return new Bun.CryptoHasher("sha256").update(Token).digest("hex");
}

export function Open(UserId: string) {
  const Token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
  const ExpiresAt = new Date(Date.now() + Lifetime);
  Database.insert(Sessions).values({ Id: Id(), UserId, Hash: Digest(Token), ExpiresAt, CreatedAt: new Date() }).run();
  return { Token, ExpiresAt };
}

export function Read(Token: string) {
  const Row = Database
    .select({ Session: Sessions, User: Users })
    .from(Sessions)
    .innerJoin(Users, eq(Sessions.UserId, Users.Id))
    .where(eq(Sessions.Hash, Digest(Token)))
    .get();
  if (!Row || Row.Session.ExpiresAt < new Date() || Row.User.SuspendedAt) return null;
  return { Id: Row.User.Id, Username: Row.User.Username, Role: Row.User.Role };
}

export function Close(Token: string) {
  Database.delete(Sessions).where(eq(Sessions.Hash, Digest(Token))).run();
  Revoke(Token);
}

export function CloseAll(UserId: string) {
  Database.delete(Sessions).where(eq(Sessions.UserId, UserId)).run();
  Drop(UserId);
}

export function Sweep() {
  Database.delete(Sessions).where(lt(Sessions.ExpiresAt, new Date())).run();
}
