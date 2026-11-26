import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { Load } from "../Store/Keys.ts";

const Key = Load("Vault", "VAULT_KEY");

export function Seal(Plain: string) {
  const Nonce = randomBytes(12);
  const Cipher = createCipheriv("aes-256-gcm", Key, Nonce);
  const Body = Buffer.concat([Cipher.update(Plain, "utf8"), Cipher.final()]);
  return [Nonce, Cipher.getAuthTag(), Body].map((Part) => Part.toString("base64url")).join(".");
}

export function Open(Sealed: string) {
  const [Nonce, Tag, Body] = Sealed.split(".").map((Part) => Buffer.from(Part, "base64url"));
  const Decipher = createDecipheriv("aes-256-gcm", Key, Nonce);
  Decipher.setAuthTag(Tag);
  return Buffer.concat([Decipher.update(Body), Decipher.final()]).toString("utf8");
}
