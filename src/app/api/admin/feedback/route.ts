import { desc, inArray } from "drizzle-orm";
import { currentMember } from "@/auth";
import { getDb, schema } from "@/db";
import { yearLabel } from "@/lib/config";
import { fmtDateTime } from "@/lib/time";

export const dynamic = "force-dynamic";

const csvCell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV of all chat feedback. Admins only. */
export async function GET() {
  const me = await currentMember();
  if (!me?.isAdmin) return new Response("Forbidden", { status: 403 });
  const db = await getDb();
  const rows = await db.query.feedback.findMany({ orderBy: desc(schema.feedback.updatedAt) });
  const bookings = rows.length ? await db.query.bookings.findMany({ where: inArray(schema.bookings.id, rows.map((r) => r.bookingId)) }) : [];
  const members = await db.query.members.findMany();
  const bookingById = new Map(bookings.map((b) => [b.id, b]));
  const memberById = new Map(members.map((m) => [m.id, m]));

  const header = ["Chat date", "Student name", "Student email", "Class year", "Host", "Host email", "Attended", "Program", "Fit rating (1-5)", "Notes", "Student topics", "Feedback updated"];
  const lines = [header.map(csvCell).join(",")];
  for (const f of rows) {
    const b = bookingById.get(f.bookingId);
    const m = memberById.get(f.memberId);
    lines.push(
      [
        b ? fmtDateTime(b.startsAt) : "",
        b?.studentName ?? "",
        b?.studentEmail ?? "",
        b?.studentYear ? yearLabel(b.studentYear) : "",
        m?.name || m?.email || "",
        m?.email ?? "",
        f.attended ? "Yes" : "No-show",
        f.program,
        f.rating ?? "",
        f.notes,
        b?.studentNotes ?? "",
        fmtDateTime(f.updatedAt),
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ali-coffee-chat-feedback.csv"`,
    },
  });
}
