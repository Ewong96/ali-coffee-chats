import type { Booking, Feedback } from "@/db/schema";

export type HostStats = { done: number; upcoming: number; noShows: number; feedbackPending: number };

/** Per-host chat counts from confirmed bookings and their feedback. A past chat counts as done unless marked no-show. */
export function hostStats(bookings: Pick<Booking, "id" | "memberId" | "endsAt" | "status">[], feedback: Pick<Feedback, "bookingId" | "attended">[]): Map<string, HostStats> {
  const fbByBooking = new Map(feedback.map((f) => [f.bookingId, f]));
  const now = Date.now();
  const out = new Map<string, HostStats>();
  for (const b of bookings) {
    if (b.status !== "confirmed") continue;
    const s = out.get(b.memberId) ?? { done: 0, upcoming: 0, noShows: 0, feedbackPending: 0 };
    if (b.endsAt.getTime() > now) s.upcoming++;
    else {
      const f = fbByBooking.get(b.id);
      if (f && !f.attended) s.noShows++;
      else s.done++;
      if (!f) s.feedbackPending++;
    }
    out.set(b.memberId, s);
  }
  return out;
}

export const emptyStats: HostStats = { done: 0, upcoming: 0, noShows: 0, feedbackPending: 0 };
