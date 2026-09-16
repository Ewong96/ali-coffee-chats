"use server";

import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { and, count, eq, gt, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { candidatesForSlot, locationFor } from "@/lib/availability";
import { syncBookingToCalendar } from "@/lib/calendarSync";
import { sendEmail } from "@/lib/email";
import { CLUB_NAME, MAX_ACTIVE_BOOKINGS_PER_STUDENT, SLOT_MINUTES, isClassYear, yearLabel, type MeetingMode } from "@/lib/config";
import { bookingWindow, fmtDateLong, fmtDateTime, fmtTime, fmtWindow, tzAbbrev } from "@/lib/time";

export type BookingInput = {
  startsAt: string; // ISO instant
  name: string;
  email: string;
  notes?: string;
  preferredMode: "any" | MeetingMode;
  year: string;
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
  if (!isClassYear(input.year)) return { ok: false, error: "Please pick your class year first." };
  const year = input.year;
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

  let candidates = await candidatesForSlot(startsAt, year);
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
        studentYear: year,
        startsAt,
        endsAt,
        mode: cand.mode,
        location,
      });
    } catch {
      continue; // slot raced by another booking for this member; try next candidate
    }

    // Create the calendar event on the member's Google Calendar; Google emails the student an invite.
    const inserted = await db.query.bookings.findFirst({ where: eq(schema.bookings.id, id) });
    const sync = inserted ? await syncBookingToCalendar(inserted, member) : { ok: false as const, error: "missing booking" };
    const calendarFailed = !sync.ok;
    const finalLocation = sync.ok ? sync.location : location;

    // Email the host (and the student, if the calendar invite could not be sent) after the response is returned.
    const whenLine = `${fmtDateLong(startsAt)}, ${fmtTime(startsAt)} – ${fmtTime(endsAt)} ${tzAbbrev(startsAt)}`;
    const whereLine = cand.mode === "in_person" ? `In person · ${finalLocation}` : finalLocation ? `Virtual · ${finalLocation}` : "Virtual · Google Meet";
    const appUrl = (process.env.AUTH_URL ?? "").replace(/\/$/, "");
    const hostFirst = (member.name || member.email).split(" ")[0];
    after(async () => {
      await sendEmail({
        to: member.email,
        replyTo: email,
        subject: `New coffee chat: ${name} on ${fmtDateTime(startsAt)}`,
        text: [
          `Hi ${hostFirst},`,
          "",
          `${name} just booked a coffee chat with you.`,
          "",
          `When:  ${whenLine}`,
          `Where: ${whereLine}`,
          `Who:   ${name} <${email}> · ${yearLabel(year)}`,
          notes ? `\nThey'd like to talk about:\n${notes}` : "",
          "",
          calendarFailed
            ? "Heads up: we couldn't add this to your Google Calendar because your Google connection has expired. Please add it to your calendar yourself and email the student to confirm. Then sign out of the dashboard and sign back in with Google to reconnect, so future bookings work."
            : "It's on your Google Calendar and the student has been sent an invite.",
          appUrl ? `\nYour dashboard: ${appUrl}/member` : "",
          "",
          `— ${CLUB_NAME} Coffee Chats`,
        ]
          .join("\n")
          .replace(/\n{3,}/g, "\n\n"),
      });
      if (calendarFailed) {
        await sendEmail({
          to: email,
          replyTo: member.email,
          subject: `Your ${CLUB_NAME} coffee chat with ${member.name || "the eboard"} is booked`,
          text: [
            `Hi ${name.split(" ")[0]},`,
            "",
            `You're booked for a coffee chat with ${member.name || member.email}${member.title ? ` (${member.title})` : ""}.`,
            "",
            `When:  ${whenLine}`,
            `Where: ${whereLine}`,
            "",
            `Your host will follow up from ${member.email}. Reply to this email if you need to reschedule.`,
            "",
            `— ${CLUB_NAME} Coffee Chats`,
          ].join("\n"),
        });
      }
    });
    return { ok: true, id };
  }
  return { ok: false, error: "Sorry, that time was just taken. Please pick another slot." };
}
