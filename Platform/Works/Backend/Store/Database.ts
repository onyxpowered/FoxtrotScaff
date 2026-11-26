import { join } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { Database as Sqlite } from "bun:sqlite";
import { Data } from "./Paths.ts";
import * as Schema from "./Schema.ts";

const Raw = new Sqlite(process.env.DB_PATH ?? join(Data, "Foxtrot.db"));
Raw.exec("PRAGMA journal_mode = WAL;");
Raw.exec("PRAGMA foreign_keys = ON;");

export const Database = drizzle(Raw, { schema: Schema });

migrate(Database, { migrationsFolder: join(import.meta.dir, "Migrations") });
