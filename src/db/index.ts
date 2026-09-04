import * as schema from "./schema";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { mkdirSync } from "node:fs";

export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;

type Holder = { promise?: Promise<DB> };
const holder: Holder = ((globalThis as unknown as { __aliDb?: Holder }).__aliDb ??= {});

async function create(): Promise<DB> {
  const url = process.env.DATABASE_URL;
  let db: DB;
  if (url) {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: url, max: 5 });
    const d = drizzle(pool, { schema });
    await migrate(d, { migrationsFolder: path.join(process.cwd(), "drizzle") });
    db = d as unknown as DB;
  } else {
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    const dir = path.join(process.cwd(), ".data", "pglite");
    mkdirSync(dir, { recursive: true });
    const client = new PGlite(dir);
    const d = drizzle(client, { schema });
    await migrate(d, { migrationsFolder: path.join(process.cwd(), "drizzle") });
    db = d as unknown as DB;
  }
  await ensureAdmin(db);
  return db;
}

async function ensureAdmin(db: DB) {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) return;
  const existing = await db.query.members.findFirst({ where: eq(schema.members.email, email) });
  if (!existing) {
    await db.insert(schema.members).values({ id: randomUUID(), email, isAdmin: true, name: "" });
  } else if (!existing.isAdmin) {
    await db.update(schema.members).set({ isAdmin: true }).where(eq(schema.members.id, existing.id));
  }
}

export function getDb(): Promise<DB> {
  if (!holder.promise) {
    holder.promise = create().catch((err) => {
      holder.promise = undefined; // allow a retry on the next request
      throw err;
    });
  }
  return holder.promise;
}

export { schema };
