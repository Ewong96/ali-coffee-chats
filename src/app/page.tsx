import { computeOpenSlots } from "@/lib/availability";
import Link from "next/link";
import { CLASS_YEARS, CLUB_NAME, isClassYear, yearLabel, type MeetingMode } from "@/lib/config";
import { bookingWindow, fmtWindow, now, toDateKey, tzAbbrev } from "@/lib/time";
import BookingGrid, { type DayInfo, type SlotInfo } from "@/components/BookingGrid";

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const { year: rawYear } = await searchParams;
  const year = isClassYear(rawYear) ? rawYear : null;
  const win = bookingWindow();
  const current = now();
  const notOpenYet = current < win.start;
  const over = current >= win.end;
  const start = current > win.start ? current : win.start;
  const end = win.end;
  const open = over || !year ? [] : await computeOpenSlots(start, end, year);

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
      ) : !year ? (
        <div className="card p-8">
          <h2 className="text-lg font-semibold text-stone-900">First, what year are you?</h2>
          <p className="mb-5 text-sm text-stone-500">Some board members chat with specific class years, so we&apos;ll show you the right openings.</p>
          <div className="grid gap-3 sm:grid-cols-4">
            {CLASS_YEARS.map((y) => (
              <Link
                key={y.id}
                href={`/?year=${y.id}`}
                className="rounded-xl border border-stone-300 px-4 py-5 text-center text-base font-medium text-stone-800 transition hover:border-amber-700 hover:bg-amber-50 hover:text-amber-900"
              >
                {y.label}
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-center gap-3 text-sm">
            <span className="rounded-full bg-amber-100 px-3 py-1 font-medium text-amber-900">Booking as a {yearLabel(year)}</span>
            <Link href="/" className="text-stone-500 underline decoration-stone-300 hover:text-stone-800">Change year</Link>
          </div>
          <BookingGrid
            days={days}
            slots={slots}
            tz={tzAbbrev()}
            year={year}
            openingNote={notOpenYet ? `Booking is open now for chats starting ${win.start.toFormat("cccc, LLLL d")}.` : undefined}
          />
        </>
      )}
    </main>
  );
}
