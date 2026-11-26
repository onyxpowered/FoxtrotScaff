import { mkdir, rename } from "node:fs/promises";
import { dirname, join } from "node:path";
import { and, eq, gt, sql } from "drizzle-orm";
import { Database } from "../Store/Database.ts";
import { Blobs, Uploads } from "../Store/Schema.ts";
import { Data } from "../Store/Paths.ts";
import { Fail } from "../Store/Fail.ts";
import { Id } from "../Store/Id.ts";
import { Detect } from "./Types.ts";
import { Scan } from "./Provenance.ts";

const Folder = join(Data, "Blobs");

export const Quota = Number(process.env.UPLOAD_QUOTA_MB ?? 500) * 1024 * 1024;

export function Locate(Hash: string) {
  return join(Folder, Hash.slice(0, 2), Hash.slice(2, 4), Hash);
}

export function Find(Hash: string) {
  if (!/^[a-f0-9]{64}$/.test(Hash)) return null;
  return Database.select().from(Blobs).where(eq(Blobs.Hash, Hash)).get() ?? null;
}

function Used(UserId: string) {
  return Database
    .select({ N: sql<number>`coalesce(sum(${Uploads.Size}), 0)` })
    .from(Uploads)
    .where(and(eq(Uploads.UserId, UserId), gt(Uploads.CreatedAt, new Date(Date.now() - 24 * 3_600_000))))
    .get()?.N ?? 0;
}

export async function Save(Bytes: Uint8Array, Name: string, UserId: string) {
  const Spec = Detect(Bytes, Name);
  if (!Spec) throw new Fail(415, "That file type is not supported");
  if (Bytes.byteLength > Spec.Cap) throw new Fail(413, "File too large");
  if (Used(UserId) + Bytes.byteLength > Quota) throw new Fail(429, "Daily upload limit reached");

  if (Spec.Mime.startsWith("image/") || Spec.Mime.startsWith("video/") || Spec.Mime.startsWith("audio/")) {
    const Found = Scan(Bytes);
    if (Found) throw new Fail(422, "This file carries AI-generation metadata. Foxtrot is human-made only.");
  }

  const Hash = new Bun.CryptoHasher("sha256").update(Bytes).digest("hex");
  const Target = Locate(Hash);

  if (!(await Bun.file(Target).exists())) {
    await mkdir(dirname(Target), { recursive: true });
    const Temp = `${Target}.${Id()}.tmp`;
    await Bun.write(Temp, Bytes);
    await rename(Temp, Target);
  }

  Database
    .insert(Blobs)
    .values({ Hash, Mime: Spec.Mime, Kind: Spec.Kind, Ext: Spec.Ext, Size: Bytes.byteLength, Width: null, Height: null, CreatedAt: new Date() })
    .onConflictDoNothing()
    .run();
  Database.insert(Uploads).values({ Id: Id(), UserId, Hash, Size: Bytes.byteLength, CreatedAt: new Date() }).run();

  return Find(Hash)!;
}
