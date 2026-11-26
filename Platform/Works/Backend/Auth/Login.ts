import { eq } from "drizzle-orm";
import { Database } from "../Store/Database.ts";
import { Credentials } from "../Store/Schema.ts";
import { Fail } from "../Store/Fail.ts";
import { ByUsername, Public, Remove } from "../Store/Users.ts";
import * as Password from "./Password.ts";
import * as Session from "./Session.ts";
import { Drop } from "../Live/Hub.ts";

const Decoy = await Password.Make("foxtrot-decoy-password");

async function Verify(UserId: string, Plain: string) {
  const Credential = Database.select().from(Credentials).where(eq(Credentials.UserId, UserId)).get();
  return Boolean(Credential) && (await Password.Check(Plain, Credential!.Hash));
}

export async function Login(Username: string, Plain: string) {
  const User = ByUsername(Username);
  const Valid = User ? await Verify(User.Id, Plain) : await Password.Check(Plain, Decoy).then(() => false);
  if (!User || !Valid || User.SuspendedAt) throw new Fail(401, "Wrong username or password");
  return { User: Public(User), Session: Session.Open(User.Id) };
}

export async function Change(UserId: string, Current: string, Next: string) {
  if (!(await Verify(UserId, Current))) throw new Fail(401, "Wrong password");
  Database.update(Credentials).set({ Hash: await Password.Make(Next) }).where(eq(Credentials.UserId, UserId)).run();
  Session.CloseAll(UserId);
  return Session.Open(UserId);
}

export async function Erase(UserId: string, Plain: string) {
  if (!(await Verify(UserId, Plain))) throw new Fail(401, "Wrong password");
  Remove(UserId);
  Drop(UserId);
}
