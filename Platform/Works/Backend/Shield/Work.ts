import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const Lifetime = 5 * 60_000;

function Sign(Secret: Buffer, Text: string) {
  return createHmac("sha256", Secret).update(Text).digest("hex");
}

function Same(A: string, B: string) {
  const X = Buffer.from(A, "hex");
  const Y = Buffer.from(B, "hex");
  return X.length === Y.length && timingSafeEqual(X, Y);
}

export function Issue(Secret: Buffer, Print: string, Difficulty: number, Now = Date.now) {
  const Nonce = randomBytes(16).toString("hex");
  const Issued = Now();
  const Signature = Sign(Secret, `${Print}.${Nonce}.${Difficulty}.${Issued}`);
  return { Challenge: `${Nonce}.${Difficulty}.${Issued}.${Signature}`, Nonce, Difficulty };
}

export function Solves(Secret: Buffer, Challenge: string, Print: string, Solution: string, Now = Date.now) {
  const [Nonce, Hard, Issued, Signature] = Challenge.split(".");
  const Difficulty = Number(Hard);
  if (!Nonce || !Signature || Solution.length > 64) return false;
  if (!Number.isInteger(Difficulty) || Difficulty < 1 || Difficulty > 8) return false;
  if (!(Now() - Number(Issued) < Lifetime)) return false;
  if (!Same(Signature, Sign(Secret, `${Print}.${Nonce}.${Difficulty}.${Issued}`))) return false;
  return createHash("sha256").update(`${Nonce}${Solution}`).digest("hex").startsWith("0".repeat(Difficulty));
}

export function Pass(Secret: Buffer, Print: string, Ttl: number, Now = Date.now) {
  const Expires = Now() + Ttl;
  return `${Print}.${Expires}.${Sign(Secret, `${Print}.${Expires}`)}`;
}

export function Passes(Secret: Buffer, Token: string, Print: string, Now = Date.now) {
  const [Owner, Expires, Signature] = Token.split(".");
  if (!Owner || !Expires || !Signature || Owner !== Print) return false;
  if (!(Number(Expires) > Now())) return false;
  return Same(Signature, Sign(Secret, `${Owner}.${Expires}`));
}
