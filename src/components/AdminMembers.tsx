"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addMember, removeMember, setMemberActive, setMemberAdmin } from "@/app/actions/admin";
import { yearLabel } from "@/lib/config";
import type { HostStats } from "@/lib/stats";

type Row = { id: string; email: string; name: string; title: string; active: boolean; isAdmin: boolean; connected: boolean; weeklySlots: number; years: string[]; stats: HostStats };

export default function AdminMembers({ members, meId }: { members: Row[]; meId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Something went wrong");
      router.refresh();
    });
  };

  return (
    <div>
      <form
        ref={formRef}
        className="mb-4 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          run(async () => {
            const res = await addMember(fd);
            if (res.ok) formRef.current?.reset();
            return res;
          });
        }}
      >
        <input name="email" type="email" required className="input" placeholder="member@school.edu" />
        <input name="name" className="input" placeholder="Name (optional)" />
        <input name="title" className="input" placeholder="Role (optional)" />
        <button className="btn-primary" disabled={pending}>Add member</button>
      </form>
      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-stone-500">
              <th className="py-2 pr-3">Member</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Chats done</th>
              <th className="py-2 pr-3">Upcoming</th>
              <th className="py-2 pr-3">Weekly slots</th>
              <th className="py-2 pr-3">Chats with</th>
              <th className="py-2 pr-3">Admin</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {members.map((m) => (
              <tr key={m.id} className={m.active ? "" : "opacity-50"}>
                <td className="py-2 pr-3">
                  <div className="font-medium text-stone-900">{m.name || <span className="text-stone-400">No name yet</span>}</div>
                  <div className="text-stone-500">{m.email}{m.title ? ` · ${m.title}` : ""}</div>
                </td>
                <td className="py-2 pr-3">
                  {!m.active ? <Badge cls="bg-stone-100 text-stone-600">Inactive</Badge> : m.connected ? <Badge cls="bg-emerald-100 text-emerald-800">Calendar connected</Badge> : <Badge cls="bg-amber-100 text-amber-800">Hasn&apos;t signed in</Badge>}
                </td>
                <td className="py-2 pr-3">
                  <span className="font-semibold text-stone-900">{m.stats.done}</span>
                  {m.stats.noShows > 0 && <span className="ml-1 text-xs text-red-700">+{m.stats.noShows} no-show{m.stats.noShows === 1 ? "" : "s"}</span>}
                  {m.stats.feedbackPending > 0 && <div className="text-xs text-amber-800">{m.stats.feedbackPending} need feedback</div>}
                </td>
                <td className="py-2 pr-3 text-stone-700">{m.stats.upcoming}</td>
                <td className="py-2 pr-3 text-stone-700">{m.weeklySlots}</td>
                <td className="py-2 pr-3 text-stone-700">{m.years.length === 4 ? "All years" : m.years.map((y) => yearLabel(y)).join(", ") || "None"}</td>
                <td className="py-2 pr-3">
                  <input type="checkbox" className="h-4 w-4 accent-amber-800" checked={m.isAdmin} disabled={pending || m.id === meId} onChange={(e) => run(() => setMemberAdmin(m.id, e.target.checked))} />
                </td>
                <td className="py-2 text-right whitespace-nowrap">
                  {m.id !== meId && (
                    <>
                      <button className="mr-3 text-xs text-stone-600 hover:text-stone-900" disabled={pending} onClick={() => run(() => setMemberActive(m.id, !m.active))}>
                        {m.active ? "Deactivate" : "Reactivate"}
                      </button>
                      <button
                        className="text-xs text-red-600 hover:text-red-800"
                        disabled={pending}
                        onClick={() => {
                          if (confirm(`Remove ${m.email}? Their availability and booking history will be deleted.`)) run(() => removeMember(m.id));
                        }}
                      >
                        Remove
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Badge({ cls, children }: { cls: string; children: React.ReactNode }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{children}</span>;
}
