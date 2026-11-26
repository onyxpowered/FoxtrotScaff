import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { Database } from "../Store/Database.ts";
import { Invites, Users } from "../Store/Schema.ts";
import { Id } from "../Store/Id.ts";
import { Fail } from "../Store/Fail.ts";
import { Count } from "../Store/Users.ts";

export type Handle = Parameters<Parameters<typeof Database.transaction>[0]>[0];

const Alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const Allowance = Number(process.env.INVITE_LIMIT ?? 5);

function Code() {
  return Array.from(crypto.getRandomValues(new Uint8Array(10)), (Byte) => Alphabet[Byte % Alphabet.length]).join("");
}

export function Create(Creator: { Id: string; Role: string }) {
  const Open = Database
    .select({ N: sql<number>`count(*)` })
    .from(Invites)
    .where(and(eq(Invites.CreatorId, Creator.Id), isNull(Invites.UsedBy)))
    .get()?.N ?? 0;
  if (Creator.Role === "member" && Open >= Allowance) throw new Fail(429, "Use or share your open invites first");

  const Row = { Id: Id(), CreatorId: Creator.Id, Code: Code(), UsedBy: null, UsedAt: null, CreatedAt: new Date() };
  Database.insert(Invites).values(Row).run();
  return Row;
}

export function Mine(UserId: string) {
  return Database
    .select({ Invite: Invites, Joined: Users })
    .from(Invites)
    .leftJoin(Users, eq(Users.Id, Invites.UsedBy))
    .where(eq(Invites.CreatorId, UserId))
    .orderBy(desc(Invites.CreatedAt))
    .all()
    .map(({ Invite, Joined }) => ({
      Code: Invite.Code,
      Used: Invite.UsedBy !== null,
      Joined: Joined ? { Username: Joined.Username, Display: Joined.Display } : null,
      UsedAt: Invite.UsedAt,
      CreatedAt: Invite.CreatedAt,
    }));
}

export function Redeem(Tx: Handle, Value: string, UserId: string) {
  const Claimed = Tx
    .update(Invites)
    .set({ UsedBy: UserId, UsedAt: new Date() })
    .where(and(eq(Invites.Code, Value.trim().toUpperCase()), isNull(Invites.UsedBy)))
    .returning({ Id: Invites.Id })
    .all();
  if (Claimed.length === 0) throw new Fail(400, "Invalid or used invite");
}

export function Bootstrap() {
  if (Count() > 0) return;
  const Waiting = Database.select().from(Invites).where(and(isNull(Invites.CreatorId), isNull(Invites.UsedBy))).get();
  const Value = Waiting?.Code ?? (() => {
    const Row = { Id: Id(), CreatorId: null, Code: Code(), UsedBy: null, UsedAt: null, CreatedAt: new Date() };
    Database.insert(Invites).values(Row).run();
    return Row.Code;
  })();
  console.log(`[foxtrot] no users yet. founder invite code: ${Value}`);
}
