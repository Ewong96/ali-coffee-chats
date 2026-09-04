import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { fmtDateLong, fmtTime, tzAbbrev } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function ConfirmedPage({ params }: PageProps<"/book/confirmed/[id]">) {
  const { id } = await params;
  const db = await getDb();
  const b = await db.query.bookings.findFirst({ where: eq(schema.bookings.id, id) });
  if (!b) notFound();
  const host = await db.query.members.findFirst({ where: eq(schema.members.id, b.memberId) });
  const isLink = /^https?:\/\//.test(b.location);

  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <div className="card p-8">
        <div className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-2xl">✓</div>
        <h1 className="text-2xl font-bold text-stone-900">You&apos;re booked, {b.studentName.split(" ")[0]}!</h1>
        <p className="mt-2 text-stone-600">
          {b.calendarError
            ? "Your chat is reserved. The calendar invite could not be sent automatically, so your host will reach out by email."
            : `A calendar invite is on its way to ${b.studentEmail}. Accept it so it shows up on your calendar.`}
        </p>

        <dl className="mt-6 divide-y divide-stone-100 rounded-xl border border-stone-200 text-sm">
          <Row k="When" v={`${fmtDateLong(b.startsAt)} · ${fmtTime(b.startsAt)} – ${fmtTime(b.endsAt)} ${tzAbbrev(b.startsAt)}`} />
          <Row k="With" v={`${host?.name || host?.email || "An eboard member"}${host?.title ? ` · ${host.title}` : ""}`} />
          <Row
            k={b.mode === "in_person" ? "Where" : "Join"}
            v={
              isLink ? (
                <a className="text-amber-800 underline" href={b.location} target="_blank" rel="noreferrer">{b.location}</a>
              ) : (
                b.location || (b.mode === "virtual" ? "Google Meet link is in your calendar invite" : "See invite")
              )
            }
          />
          {b.studentNotes && <Row k="Topics" v={b.studentNotes} />}
        </dl>

        <p className="mt-6 text-xs text-stone-500">Can&apos;t make it? Reply to the calendar invite so your host can free up the slot.</p>
        <Link href="/" className="btn-secondary mt-6">Back to calendar</Link>
      </div>
    </main>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[5rem_1fr] gap-3 px-4 py-3">
      <dt className="font-medium text-stone-500">{k}</dt>
      <dd className="text-stone-900">{v}</dd>
    </div>
  );
}
