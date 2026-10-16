// Applies the SQL migrations in drizzle/ that the database hasn't seen yet, the way drizzle-kit
// migrate does (same `drizzle.__drizzle_migrations` table, same file hashes), so the production
// container can run it before starting Next.js. Only needs `pg`, which the app already ships.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const folder = path.resolve(process.argv[2] ?? "drizzle");
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("migrate: DATABASE_URL is not set");
  process.exit(1);
}

const journal = JSON.parse(await readFile(path.join(folder, "meta/_journal.json"), "utf8"));
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query("CREATE SCHEMA IF NOT EXISTS drizzle");
  await client.query(
    "CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)",
  );
  const { rows } = await client.query("SELECT created_at FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 1");
  const latest = rows[0] ? Number(rows[0].created_at) : 0;
  let applied = 0;
  for (const entry of journal.entries) {
    if (entry.when <= latest) continue;
    const sql = await readFile(path.join(folder, `${entry.tag}.sql`), "utf8");
    const hash = createHash("sha256").update(sql).digest("hex");
    await client.query("BEGIN");
    try {
      for (const statement of sql.split("--> statement-breakpoint")) {
        if (statement.trim()) await client.query(statement);
      }
      await client.query("INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)", [hash, entry.when]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
    console.log(`migrate: applied ${entry.tag}`);
    applied++;
  }
  if (!applied) console.log("migrate: up to date");
} finally {
  await client.end();
}
