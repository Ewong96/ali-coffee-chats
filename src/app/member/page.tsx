import { redirect } from "next/navigation";
import { and, asc, desc, eq, gte, lt } from "drizzle-orm";
import { currentMember, signOut } from "@/auth";
import { getDb, schema } from "@/db";
import { fmtWindow, now, toDateKey } from "@/lib/time";
import AvailabilityGrid from "@/components/AvailabilityGrid";
import ProfileForm from "@/components/ProfileForm";
import ExceptionsEditor from "@/components/ExceptionsEditor";
import UpcomingChats from "@/components/UpcomingChats";
import FeedbackPanel from "@/components/FeedbackPanel";
import { hostStats, emptyStats } from "@/lib/stats";

export const dynamic = "force-dynamic";

export default async function MemberPage() {
  const me = await currentMember();
  if (!me) redirect("/member/login");
  const db = await getDb();
  const [rules, exceptions, upcoming, past, myFeedback] = await Promise.all([
    db.query.availabilityRules.findMany({ where: eq(schema.availabilityRules.memberId, me.id) }),
    db.query.availabilityExceptions.findMany({
      where: and(eq(schema.availabilityExceptions.memberId, me.id), gte(schema.availabilityExceptions.date, toDateKey(now()))),
    }),
    db.query.bookings.findMany({
      where: and(eq(schema.bookings.memberId, me.id), eq(schema.bookings.status, "confirmed"), gte(schema.bookings.endsAt, new Date())),
      orderBy: asc(schema.bookings.startsAt),
    }),
    db.query.bookings.findMany({
      where: and(eq(schema.bookings.memberId, me.id), eq(schema.bookings.status, "confirmed"), lt(schema.bookings.endsAt, new Date())),
      orderBy: desc(schema.bookings.startsAt),
    }),
    db.query.feedback.findMany({ where: eq(schema.feedback.memberId, me.id) }),
  ]);
  const feedbackByBooking = new Map(myFeedback.map((f) => [f.bookingId, f]));
  const myStats = hostStats([...upcoming, ...past], myFeedback).get(me.id) ?? emptyStats;
  const profileIncomplete = !me.name || (me.defaultMode === "in_person" && !me.location);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {me.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={me.image} alt="" className="h-12 w-12 rounded-full" referrerPolicy="no-referrer" />
          ) : (
            <div className="grid h-12 w-12 place-items-center rounded-full bg-amber-100 text-amber-900">{(me.name || me.email)[0]?.toUpperCase()}</div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-stone-900">{me.name || "Welcome!"}</h1>
            <p className="text-sm text-stone-500">{me.email}{me.title ? ` · ${me.title}` : ""}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-2 text-sm">
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-800"><b>{myStats.done}</b> done</span>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-900"><b>{myStats.upcoming}</b> upcoming</span>
            {myStats.feedbackPending > 0 && <span className="rounded-full bg-stone-100 px-3 py-1 text-stone-700"><b>{myStats.feedbackPending}</b> need feedback</span>}
          </div>
          <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}>
            <button className="btn-secondary">Sign out</button>
          </form>
        </div>
      </div>

      {!me.googleRefreshToken && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Google Calendar isn&apos;t connected, so students can&apos;t book you yet. Sign out and sign in again, making sure to allow calendar access.
        </div>
      )}
      {me.googleRefreshToken && profileIncomplete && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Finish your profile below (name and a default meeting spot) so students know who they&apos;re meeting and where.
        </div>
      )}

      <div className="space-y-6">
        <section className="card p-6">
          <h2 className="text-lg font-semibold text-stone-900">Profile &amp; meeting defaults</h2>
          <p className="mb-4 text-sm text-stone-500">Students see your name and title after booking. Meeting details go into the calendar invite.</p>
          <ProfileForm member={me} />
        </section>

        <section className="card p-6">
          <h2 className="text-lg font-semibold text-stone-900">Weekly availability</h2>
          <p className="mb-4 text-sm text-stone-500">
            Coffee chats run <span className="font-medium text-stone-700">{fmtWindow()}</span>. Click or drag to open 30-minute slots that repeat each week
            during that stretch. Click a slot again to make it in-person only, again for virtual only, and once more to close it.
          </p>
          <AvailabilityGrid initialRules={rules.map((r) => ({ weekday: r.weekday, startMin: r.startMin, mode: (r.mode as "in_person" | "virtual" | null) ?? null }))} defaultMode={me.defaultMode as "in_person" | "virtual"} />
        </section>

        <section className="card p-6">
          <h2 className="text-lg font-semibold text-stone-900">Date overrides</h2>
          <p className="mb-4 text-sm text-stone-500">Travelling, or free on a day you normally aren&apos;t? Block or open slots for a specific date.</p>
          <ExceptionsEditor
            rules={rules.map((r) => ({ weekday: r.weekday, startMin: r.startMin }))}
            exceptions={exceptions.map((e) => ({ date: e.date, startMin: e.startMin, kind: e.kind as "block" | "open" }))}
            today={toDateKey(now())}
          />
        </section>

        <section className="card p-6">
          <h2 className="text-lg font-semibold text-stone-900">Upcoming chats</h2>
          <p className="mb-4 text-sm text-stone-500">Cancelling removes the event from Google Calendar and emails the student.</p>
          <UpcomingChats
            bookings={upcoming.map((b) => ({
              id: b.id,
              studentName: b.studentName,
              studentEmail: b.studentEmail,
              studentNotes: b.studentNotes,
              studentYear: b.studentYear,
              startsAt: b.startsAt.toISOString(),
              mode: b.mode as "in_person" | "virtual",
              location: b.location,
              calendarError: b.calendarError,
            }))}
          />
        </section>

        <section className="card p-6">
          <h2 className="text-lg font-semibold text-stone-900">Past chats &amp; feedback</h2>
          <p className="mb-4 text-sm text-stone-500">After each chat, jot down how it went. Admins see all feedback in one place.</p>
          <FeedbackPanel
            today={toDateKey(now())}
            chats={past.map((b) => {
              const f = feedbackByBooking.get(b.id);
              return {
                id: b.id,
                studentName: b.studentName,
                studentEmail: b.studentEmail,
                studentYear: b.studentYear,
                studentNotes: b.studentNotes,
                startsAt: b.startsAt.toISOString(),
                manual: b.source === "manual",
                feedback: f ? { attended: f.attended, program: f.program, rating: f.rating, notes: f.notes } : null,
              };
            })}
          />
        </section>
      </div>
    </main>
  );
}
