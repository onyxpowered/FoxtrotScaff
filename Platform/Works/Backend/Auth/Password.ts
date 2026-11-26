export function Make(Plain: string) {
  return Bun.password.hash(Plain, { algorithm: "argon2id" });
}

export function Check(Plain: string, Hash: string) {
  return Bun.password.verify(Plain, Hash);
}
