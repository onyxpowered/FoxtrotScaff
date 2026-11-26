import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Data } from "./Paths.ts";

export function Load(Name: string, Env?: string) {
  const Given = Env ? process.env[Env] : undefined;
  if (Given) return Buffer.from(Given, "hex");

  const Folder = join(Data, "Keys");
  const File = join(Folder, `${Name}.key`);
  if (!existsSync(File)) {
    mkdirSync(Folder, { recursive: true, mode: 0o700 });
    writeFileSync(File, randomBytes(32).toString("hex"), { mode: 0o600 });
  }
  return Buffer.from(readFileSync(File, "utf8"), "hex");
}
