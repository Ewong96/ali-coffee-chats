import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Booking, Member } from "@/db/schema";
import { CLUB_NAME, yearLabel } from "./config";
import { GoogleAuthError, createEvent, markGoogleDisconnected } from "./google";
import { fmtDateTime, tzAbbrev } from "./time";

export type SyncResult = { ok: true; location: string } | { ok: false; error: string };

/**
 * Create the Google Calendar event for a booking on the host's calendar (student as guest) and
 * record the result on the booking. Safe to call again after a failure.
 */
export async function syncBookingToCalendar(booking: Booking, member: Member): Promise<SyncResult> {
  const db = await getDb();
  if (booking.googleEventId) return { ok: true, location: booking.location };
  if (!member.googleRefreshToken) {
    return { ok: false, error: "Host is not connected to Google Calendar." };
  }
  const useMeet = booking.mode === "virtual" && !member.virtualLink;
  const location = booking.mode === "in_person" ? member.location || booking.location : member.virtualLink || booking.location;
  const modeLabel =
    booking.mode === "in_person" ? `In person — ${location}` : useMeet ? "Virtual — Google Meet (link in this invite)" : `Virtual — ${location}`;
  const description = [
    `${CLUB_NAME} coffee chat between ${booking.studentName} and ${member.name || member.email}${member.title ? ` (${member.title})` : ""}.`,
    "",
    modeLabel,
    `When: ${fmtDateTime(booking.startsAt)} ${tzAbbrev(booking.startsAt)}`,
    "",
    booking.studentNotes ? `What ${booking.studentName} would like to talk about:\n${booking.studentNotes}` : "",
    "",
    `Student: ${booking.studentName} <${booking.studentEmail}>${booking.studentYear ? ` · ${yearLabel(booking.studentYear)}` : ""}`,
    `Host: ${member.name || member.email} <${member.email}>`,
    "",
    `Need to reschedule? Reply to this invite so your host can cancel and you can rebook.`,
  ]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");

  try {
    const ev = await createEvent({
      refreshToken: member.googleRefreshToken,
      summary: `${CLUB_NAME} Coffee Chat: ${booking.studentName} & ${member.name || member.email}`,
      description,
      start: booking.startsAt,
      end: booking.endsAt,
      attendees: booking.studentEmail ? [{ email: booking.studentEmail, displayName: booking.studentName }] : [],
      location: useMeet ? undefined : location,
      createMeet: useMeet,
      requestId: booking.id,
    });
    const finalLocation = useMeet && ev.hangoutLink ? ev.hangoutLink : location;
    await db
      .update(schema.bookings)
      .set({ googleEventId: ev.id, location: finalLocation, calendarError: null })
      .where(eq(schema.bookings.id, booking.id));
    return { ok: true, location: finalLocation };
  } catch (err) {
    console.error("Calendar event failed", err);
    const message = err instanceof Error ? err.message.slice(0, 500) : "unknown error";
    if (err instanceof GoogleAuthError) await markGoogleDisconnected(member.id, err.message).catch(() => {});
    await db.update(schema.bookings).set({ calendarError: message }).where(eq(schema.bookings.id, booking.id));
    return { ok: false, error: message };
  }
}
