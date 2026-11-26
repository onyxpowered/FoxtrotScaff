import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./Store/Schema.ts",
  out: "./Store/Migrations",
  dialect: "sqlite",
  dbCredentials: { url: process.env.DB_PATH ?? "Foxtrot.db" },
});
