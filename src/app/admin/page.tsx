import { redirect } from "next/navigation";
import { and, asc, eq, gte } from "drizzle-orm";
import { currentMember } from "@/auth";
import { getDb, schema } from "@/db";
import AdminMembers from "@/components/AdminMembers";
import UpcomingChats from "@/components/UpcomingChats";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const me = await currentMember();
  if (!me) redirect("/member/login");
  if (!me.isAdmin) redirect("/member");
  const db = await getDb();
  const [members, upcoming, ruleCounts] = await Promise.all([
    db.query.members.findMany({ orderBy: asc(schema.members.email) }),
    db.query.bookings.findMany({
      where: and(eq(schema.bookings.status, "confirmed"), gte(schema.bookings.endsAt, new Date())),
      orderBy: asc(schema.bookings.startsAt),
    }),
    db.query.availabilityRules.findMany({ columns: { memberId: true } }),
  ]);
  const slotsBy = new Map<string, number>();
  for (const r of ruleCounts) slotsBy.set(r.memberId, (slotsBy.get(r.memberId) ?? 0) + 1);
  const nameOf = new Map(members.map((m) => [m.id, m.name || m.email]));

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold text-stone-900">Admin</h1>
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
              startsAt: b.startsAt.toISOString(),
              mode: b.mode as "in_person" | "virtual",
              location: b.location,
              calendarError: b.calendarError,
              hostName: nameOf.get(b.memberId),
            }))}
          />
        </section>
      </div>
    </main>
  );
}
