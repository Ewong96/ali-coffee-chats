"use server";

import { randomUUID } from "node:crypto";
import { and, count, eq, gt, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { candidatesForSlot, locationFor } from "@/lib/availability";
import { createEvent } from "@/lib/google";
import { CLUB_NAME, MAX_ACTIVE_BOOKINGS_PER_STUDENT, SLOT_MINUTES, type MeetingMode } from "@/lib/config";
import { bookingWindow, fmtDateTime, fmtWindow, tzAbbrev } from "@/lib/time";

export type BookingInput = {
  startsAt: string; // ISO instant
  name: string;
  email: string;
  notes?: string;
  preferredMode: "any" | MeetingMode;
};

export type BookingResult = { ok: true; id: string } | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function createBooking(input: BookingInput): Promise<BookingResult> {
  const name = (input.name ?? "").trim().slice(0, 100);
  const email = (input.email ?? "").trim().toLowerCase();
  const notes = (input.notes ?? "").trim().slice(0, 1000);
  const startsAt = new Date(input.startsAt);
  if (!name) return { ok: false, error: "Please enter your name." };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Please enter a valid email." };
  if (Number.isNaN(startsAt.getTime())) return { ok: false, error: "Invalid time." };
  const win = bookingWindow();
  if (startsAt < win.start.toJSDate() || startsAt >= win.end.toJSDate()) {
    return { ok: false, error: `Coffee chats only run ${fmtWindow()}.` };
  }

  const db = await getDb();

  // One active booking per student.
  const [{ n: active }] = await db
    .select({ n: count() })
    .from(schema.bookings)
    .where(and(eq(schema.bookings.studentEmail, email), eq(schema.bookings.status, "confirmed"), gt(schema.bookings.startsAt, new Date())));
  if (active >= MAX_ACTIVE_BOOKINGS_PER_STUDENT) {
    return { ok: false, error: "You already have an upcoming coffee chat. Check your calendar invite for details." };
  }

  let candidates = await candidatesForSlot(startsAt);
  if (input.preferredMode !== "any") candidates = candidates.filter((c) => c.mode === input.preferredMode);
  if (!candidates.length) return { ok: false, error: "Sorry, that time was just taken. Please pick another slot." };

  // Least-booked member first, random tie-break.
  const ids = candidates.map((c) => c.memberId);
  const loads = await db
    .select({ memberId: schema.bookings.memberId, n: count() })
    .from(schema.bookings)
    .where(and(inArray(schema.bookings.memberId, ids), eq(schema.bookings.status, "confirmed"), gt(schema.bookings.startsAt, new Date())))
    .groupBy(schema.bookings.memberId);
  const loadOf = new Map(loads.map((l) => [l.memberId, Number(l.n)]));
  const ordered = [...candidates]
    .map((c) => ({ c, load: loadOf.get(c.memberId) ?? 0, r: Math.random() }))
    .sort((a, b) => a.load - b.load || a.r - b.r)
    .map((x) => x.c);

  const members = await db.query.members.findMany({ where: inArray(schema.members.id, ids) });
  const endsAt = new Date(startsAt.getTime() + SLOT_MINUTES * 60_000);

  for (const cand of ordered) {
    const member = members.find((m) => m.id === cand.memberId);
    if (!member?.googleRefreshToken) continue;
    const id = randomUUID();
    const location = locationFor(member, cand.mode);
    try {
      await db.insert(schema.bookings).values({
        id,
        memberId: member.id,
        studentName: name,
        studentEmail: email,
        studentNotes: notes,
        startsAt,
        endsAt,
        mode: cand.mode,
        location,
      });
    } catch {
      continue; // slot raced by another booking for this member; try next candidate
    }

    // Create the calendar event on the member's Google Calendar; Google emails both parties.
    try {
      const useMeet = cand.mode === "virtual" && !member.virtualLink;
      const modeLabel = cand.mode === "in_person" ? `In person — ${location}` : useMeet ? "Virtual — Google Meet (link in this invite)" : `Virtual — ${location}`;
      const description = [
        `${CLUB_NAME} coffee chat between ${name} and ${member.name || member.email}${member.title ? ` (${member.title})` : ""}.`,
        "",
        modeLabel,
        `When: ${fmtDateTime(startsAt)} ${tzAbbrev(startsAt)}`,
        "",
        notes ? `What ${name} would like to talk about:\n${notes}` : "",
        "",
        `Student: ${name} <${email}>`,
        `Host: ${member.name || member.email} <${member.email}>`,
        "",
        `Need to reschedule? Reply to this invite so your host can cancel and you can rebook.`,
      ]
        .join("\n")
        .replace(/\n{3,}/g, "\n\n");
      const ev = await createEvent({
        refreshToken: member.googleRefreshToken,
        summary: `${CLUB_NAME} Coffee Chat: ${name} & ${member.name || member.email}`,
        description,
        start: startsAt,
        end: endsAt,
        attendees: [{ email, displayName: name }],
        location: useMeet ? undefined : location,
        createMeet: useMeet,
        requestId: id,
      });
      await db
        .update(schema.bookings)
        .set({ googleEventId: ev.id, location: useMeet && ev.hangoutLink ? ev.hangoutLink : location })
        .where(eq(schema.bookings.id, id));
    } catch (err) {
      console.error("Calendar event failed", err);
      await db
        .update(schema.bookings)
        .set({ calendarError: err instanceof Error ? err.message.slice(0, 500) : "unknown error" })
        .where(eq(schema.bookings.id, id));
    }
    return { ok: true, id };
  }
  return { ok: false, error: "Sorry, that time was just taken. Please pick another slot." };
}
