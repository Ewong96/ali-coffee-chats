// Dev helper: inserts a past booking for the admin member so the feedback flow can be tested locally.
// Run with the dev server STOPPED (PGlite allows one process): node scripts/seed-past-booking.mjs
import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const db = new PGlite(fileURLToPath(new URL("../.data/pglite", import.meta.url)));
const admin = (await db.query("select id from members where is_admin = true limit 1")).rows[0];
if (!admin) throw new Error("No admin member yet. Sign in once first.");
const start = new Date(Date.now() - 24 * 3600 * 1000);
start.setMinutes(0, 0, 0);
const end = new Date(start.getTime() + 30 * 60 * 1000);
await db.query(
  `insert into bookings (id, member_id, student_name, student_email, student_notes, student_year, starts_at, ends_at, mode, location, status)
   values ($1,$2,$3,$4,$5,$6,$7,$8,'in_person','Starbucks in the Student Union','confirmed')`,
  [randomUUID(), admin.id, "Marcus Lee", "marcus.lee@school.edu", "Wants to know about the analyst program.", "freshman", start, end],
);
console.log("Inserted past booking at", start.toISOString());
await db.close();
