import "dotenv/config";
import type { Config } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  console.error(
    "DATABASE_URL is not set. Set it in .env or the environment. For local dev: postgresql://localhost:5432/your_db"
  );
  process.exit(1);
}

export default {
  schema: "./shared/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // Keep all tables under the `app` schema (not `public`).
  schemaFilter: ["app"],
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
} satisfies Config;
