import { mkdirSync } from "node:fs";
import { join } from "node:path";

export const Root = join(import.meta.dir, "..");
export const Data = process.env.DATA_DIR ?? join(Root, ".Data");

mkdirSync(Data, { recursive: true });
