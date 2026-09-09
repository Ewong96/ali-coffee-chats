import { redirect } from "next/navigation";
import { and, asc, desc, eq, gte, inArray } from "drizzle-orm";
import { currentMember } from "@/auth";
import { getDb, schema } from "@/db";
import AdminMembers from "@/components/AdminMembers";
import UpcomingChats from "@/components/UpcomingChats";
import { yearLabel } from "@/lib/config";
import { fmtDateTime } from "@/lib/time";
import { emptyStats, hostStats } from "@/lib/stats";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const me = await currentMember();
  if (!me) redirect("/member/login");
  if (!me.isAdmin) redirect("/member");
  const db = await getDb();
  const [members, upcoming, ruleCounts, allFeedback, allConfirmed] = await Promise.all([
    db.query.members.findMany({ orderBy: asc(schema.members.email) }),
    db.query.bookings.findMany({
      where: and(eq(schema.bookings.status, "confirmed"), gte(schema.bookings.endsAt, new Date())),
      orderBy: asc(schema.bookings.startsAt),
    }),
    db.query.availabilityRules.findMany({ columns: { memberId: true } }),
    db.query.feedback.findMany({ orderBy: desc(schema.feedback.updatedAt) }),
    db.query.bookings.findMany({ where: eq(schema.bookings.status, "confirmed"), columns: { id: true, memberId: true, endsAt: true, status: true, studentEmail: true } }),
  ]);
  const stats = hostStats(allConfirmed, allFeedback);
  const totals = [...stats.values()].reduce((a, s) => ({ done: a.done + s.done, upcoming: a.upcoming + s.upcoming, noShows: a.noShows + s.noShows, feedbackPending: a.feedbackPending + s.feedbackPending }), { ...emptyStats });
  const uniqueStudents = new Set(allConfirmed.map((b) => b.studentEmail).filter(Boolean)).size;
  const feedbackBookings = allFeedback.length
    ? await db.query.bookings.findMany({ where: inArray(schema.bookings.id, allFeedback.map((f) => f.bookingId)) })
    : [];
  const bookingById = new Map(feedbackBookings.map((b) => [b.id, b]));
  const slotsBy = new Map<string, number>();
  for (const r of ruleCounts) slotsBy.set(r.memberId, (slotsBy.get(r.memberId) ?? 0) + 1);
  const nameOf = new Map(members.map((m) => [m.id, m.name || m.email]));

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold text-stone-900">Admin</h1>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Chats completed" value={totals.done} />
        <Stat label="Upcoming" value={totals.upcoming} />
        <Stat label="Students reached" value={uniqueStudents} />
        <Stat label="No-shows" value={totals.noShows} />
      </div>
      <div className="space-y-6">
        <section className="card p-6">
          <h2 className="text-lg font-semibold text-stone-900">Eboard members</h2>
          <p className="mb-4 text-sm text-stone-500">Only these emails can sign in. Members need to sign in once with Google before students can book them.</p>
          <AdminMembers
            meId={me.id}
            members={members.map((m) => ({
              id: m.id,
              email: m.email,
              name: m.name,
              title: m.title,
              active: m.active,
              isAdmin: m.isAdmin,
              connected: !!m.googleRefreshToken,
              weeklySlots: slotsBy.get(m.id) ?? 0,
              years: m.acceptedYears.split(",").filter(Boolean),
              stats: stats.get(m.id) ?? emptyStats,
            }))}
          />
        </section>
        <section className="card p-6">
          <h2 className="text-lg font-semibold text-stone-900">All upcoming chats</h2>
          <p className="mb-4 text-sm text-stone-500">{upcoming.length} scheduled.</p>
          <UpcomingChats
            showHost
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
              hostName: nameOf.get(b.memberId),
            }))}
          />
        </section>
        <section className="card p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-stone-900">Chat feedback</h2>
              <p className="text-sm text-stone-500">{allFeedback.length} entr{allFeedback.length === 1 ? "y" : "ies"} from hosts.</p>
            </div>
            <a href="/api/admin/feedback" className="btn-secondary" download>Download CSV</a>
          </div>
          {allFeedback.length === 0 ? (
            <p className="text-sm text-stone-500">No feedback yet. Hosts leave it from their dashboard after each chat.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-stone-500">
                    <th className="py-2 pr-3">Chat</th>
                    <th className="py-2 pr-3">Student</th>
                    <th className="py-2 pr-3">Host</th>
                    <th className="py-2 pr-3">Attended</th>
                    <th className="py-2 pr-3">Program</th>
                    <th className="py-2 pr-3">Fit</th>
                    <th className="py-2">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 align-top">
                  {allFeedback.map((f) => {
                    const b = bookingById.get(f.bookingId);
                    return (
                      <tr key={f.id}>
                        <td className="py-2 pr-3 whitespace-nowrap text-stone-700">
                          {b ? fmtDateTime(b.startsAt) : "—"}
                          {b?.source === "manual" && <div className="text-xs text-stone-500">logged manually</div>}
                        </td>
                        <td className="py-2 pr-3">
                          <div className="font-medium text-stone-900">{b?.studentName ?? "—"}</div>
                          <div className="text-stone-500">{[b?.studentEmail, b?.studentYear ? yearLabel(b.studentYear) : ""].filter(Boolean).join(" · ")}</div>
                        </td>
                        <td className="py-2 pr-3 text-stone-700">{nameOf.get(f.memberId) ?? "—"}</td>
                        <td className="py-2 pr-3">{f.attended ? <span className="text-emerald-700">Yes</span> : <span className="text-red-700">No-show</span>}</td>
                        <td className="py-2 pr-3 text-stone-700">{f.program || "—"}</td>
                        <td className="py-2 pr-3 text-stone-700">{f.rating ? `${f.rating}/5` : "—"}</td>
                        <td className="py-2 max-w-md whitespace-pre-wrap text-stone-700">{f.notes || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-stone-900">{value}</div>
    </div>
  );
}
