import pg from "pg";

const { Client } = pg;
const REQUIRED_STATUSES = ["open", "upcoming", "closed", "active", "completed", "cancelled"];

function quoteIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

async function resolveEnumSchema(client, enumName) {
  const result = await client.query(
    `SELECT n.nspname AS enum_schema
       FROM pg_type t
       JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE t.typname = $1
        AND t.typtype = 'e'
      ORDER BY CASE WHEN n.nspname = 'app' THEN 0 WHEN n.nspname = 'public' THEN 1 ELSE 2 END
      LIMIT 1`,
    [enumName],
  );
  return String(result.rows?.[0]?.enum_schema || "");
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();

  try {
    const enumSchema = await resolveEnumSchema(client, "competition_status");
    if (!enumSchema) {
      throw new Error("Base schema is missing the competition_status enum; database schema push must complete before tournament sync");
    }

    const qualifiedType = `${quoteIdentifier(enumSchema)}.${quoteIdentifier("competition_status")}`;
    for (const status of REQUIRED_STATUSES) {
      await client.query(`ALTER TYPE ${qualifiedType} ADD VALUE IF NOT EXISTS '${status}'`);
    }

    const valuesResult = await client.query(
      `SELECT e.enumlabel
         FROM pg_type t
         JOIN pg_namespace n ON n.oid = t.typnamespace
         JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE t.typname = 'competition_status'
          AND n.nspname = $1
        ORDER BY e.enumsortorder`,
      [enumSchema],
    );
    const actual = new Set(valuesResult.rows.map((row) => String(row.enumlabel)));
    const missing = REQUIRED_STATUSES.filter((status) => !actual.has(status));
    if (missing.length) {
      throw new Error(`competition_status enum repair incomplete; missing: ${missing.join(", ")}`);
    }

    console.log(`Prepared enum ${enumSchema}.competition_status: ${REQUIRED_STATUSES.join(", ")}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Competition status enum preflight failed:", error);
  process.exitCode = 1;
});
