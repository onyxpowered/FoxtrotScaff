import { eq, sql } from "drizzle-orm";
import { Database } from "../Store/Database.ts";
import { Users, Credentials, Preferences } from "../Store/Schema.ts";
import { Id } from "../Store/Id.ts";
import { Fail } from "../Store/Fail.ts";
import { Public } from "../Store/Users.ts";
import { Redeem } from "../Invites/Invites.ts";
import * as Password from "./Password.ts";
import * as Session from "./Session.ts";

const Reserved = new Set([
  "admin", "api", "media", "login", "logout", "register", "settings", "support", "help", "about", "terms",
  "privacy", "mod", "moderator", "system", "root", "foxtrot", "me", "search", "feed", "messages", "notifications",
]);

export type Input = { Username: string; Display: string; Password: string; Invite: string; Pledge: true };

export async function Register(Input: Input) {
  if (Reserved.has(Input.Username)) throw new Fail(409, "Username taken");
  const Hash = await Password.Make(Input.Password);

  const Created = Database.transaction((Tx) => {
    if (Tx.select().from(Users).where(eq(Users.Username, Input.Username)).get()) throw new Fail(409, "Username taken");

    const Founder = (Tx.select({ N: sql<number>`count(*)` }).from(Users).get()?.N ?? 0) === 0;
    const Row = {
      Id: Id(),
      Username: Input.Username,
      Display: Input.Display,
      Bio: "",
      Avatar: null,
      City: null,
      Region: null,
      Role: Founder ? ("admin" as const) : ("member" as const),
      SuspendedAt: null,
      PledgedAt: new Date(),
      CreatedAt: new Date(),
    };

    Tx.insert(Users).values(Row).run();
    Tx.insert(Credentials).values({ UserId: Row.Id, Hash, CreatedAt: Row.CreatedAt }).run();
    Tx.insert(Preferences).values({ UserId: Row.Id, MaxRating: "safe" }).run();
    Redeem(Tx, Input.Invite, Row.Id);
    return Row;
  });

  return { User: Public(Created), Session: Session.Open(Created.Id) };
}
