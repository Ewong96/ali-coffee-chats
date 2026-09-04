import { computeOpenSlots } from "@/lib/availability";
import { CLUB_NAME, type MeetingMode } from "@/lib/config";
import { bookingWindow, fmtWindow, now, toDateKey, tzAbbrev } from "@/lib/time";
import BookingGrid, { type DayInfo, type SlotInfo } from "@/components/BookingGrid";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const win = bookingWindow();
  const current = now();
  const notOpenYet = current < win.start;
  const over = current >= win.end;
  const start = current > win.start ? current : win.start;
  const end = win.end;
  const open = over ? [] : await computeOpenSlots(start, end);

  const days: DayInfo[] = [];
  for (let d = start.startOf("day"); d < end; d = d.plus({ days: 1 })) {
    days.push({ dateKey: toDateKey(d), weekday: d.toFormat("ccc"), date: d.toFormat("LLL d") });
  }
  const slots: SlotInfo[] = open.map((s) => ({
    iso: s.startsAt.toISOString(),
    dateKey: s.dateKey,
    startMin: s.startMin,
    modes: [...new Set(s.candidates.map((c) => c.mode))] as MeetingMode[],
  }));

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">Grab a coffee chat with the {CLUB_NAME} eboard</h1>
        <p className="mt-3 text-stone-600">
          Coffee chats run <span className="font-medium text-stone-800">{fmtWindow()}</span>. Pick any time that works for you. We&apos;ll match you with an
          available board member and send a calendar invite to you both. Chats are 30 minutes. Times are shown in {tzAbbrev()}.
        </p>
      </div>
      {over ? (
        <div className="card p-10 text-center text-stone-600">
          <p className="text-lg font-medium text-stone-800">Coffee chats have wrapped up for this round</p>
          <p className="mt-1 text-sm">Thanks for your interest! Keep an eye out for the next round.</p>
        </div>
      ) : (
        <BookingGrid days={days} slots={slots} tz={tzAbbrev()} openingNote={notOpenYet ? `Booking is open now for chats starting ${win.start.toFormat("cccc, LLLL d")}.` : undefined} />
      )}
    </main>
  );
}
