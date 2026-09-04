"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBooking } from "@/app/actions/book";
import type { MeetingMode } from "@/lib/config";
import { minutesLabel, slotRangeLabel } from "@/lib/time";

export type DayInfo = { dateKey: string; weekday: string; date: string };
export type SlotInfo = { iso: string; dateKey: string; startMin: number; modes: MeetingMode[] };

const MODE_LABEL: Record<MeetingMode, string> = { in_person: "In person", virtual: "Virtual" };
const MODE_ICON: Record<MeetingMode, string> = { in_person: "📍", virtual: "💻" };

export default function BookingGrid({ days, slots, tz, openingNote }: { days: DayInfo[]; slots: SlotInfo[]; tz: string; openingNote?: string }) {
  const weeks = useMemo(() => {
    const out: DayInfo[][] = [];
    for (let i = 0; i < days.length; i += 7) out.push(days.slice(i, i + 7));
    return out;
  }, [days]);
  const byDay = useMemo(() => {
    const m = new Map<string, SlotInfo[]>();
    for (const s of slots) {
      if (!m.has(s.dateKey)) m.set(s.dateKey, []);
      m.get(s.dateKey)!.push(s);
    }
    return m;
  }, [slots]);

  const [week, setWeek] = useState(0);
  const [selected, setSelected] = useState<{ slot: SlotInfo; day: DayInfo } | null>(null);
  const weekDays = weeks[week] ?? [];
  const rangeLabel = weekDays.length ? `${weekDays[0].date} – ${weekDays[weekDays.length - 1].date}` : "";

  if (!slots.length) {
    return (
      <div className="card p-10 text-center text-stone-600">
        <p className="text-lg font-medium text-stone-800">No openings right now</p>
        <p className="mt-1 text-sm">The eboard hasn&apos;t posted availability yet. Check back soon!</p>
      </div>
    );
  }

  return (
    <div>
      {openingNote && <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{openingNote}</p>}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button className="btn-secondary px-3" onClick={() => setWeek((w) => Math.max(0, w - 1))} disabled={week === 0} aria-label="Previous week">←</button>
          <span className="min-w-36 text-center text-sm font-medium text-stone-700">{rangeLabel}</span>
          <button className="btn-secondary px-3" onClick={() => setWeek((w) => Math.min(weeks.length - 1, w + 1))} disabled={week >= weeks.length - 1} aria-label="Next week">→</button>
        </div>
        <div className="hidden items-center gap-4 text-xs text-stone-500 sm:flex">
          <span>📍 In person</span>
          <span>💻 Virtual</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {weekDays.map((d) => {
          const list = byDay.get(d.dateKey) ?? [];
          return (
            <div key={d.dateKey} className="card flex min-h-40 flex-col p-3">
              <div className="mb-2 border-b border-stone-100 pb-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">{d.weekday}</div>
                <div className="text-lg font-semibold text-stone-900">{d.date}</div>
              </div>
              {list.length === 0 ? (
                <div className="my-auto text-center text-xs text-stone-400">No openings</div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {list.map((s) => (
                    <button
                      key={s.iso}
                      onClick={() => setSelected({ slot: s, day: d })}
                      className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-left text-sm font-medium text-amber-900 transition hover:border-amber-400 hover:bg-amber-100"
                    >
                      <span>{minutesLabel(s.startMin)}</span>
                      <span className="text-xs" title={s.modes.map((m) => MODE_LABEL[m]).join(" or ")}>
                        {s.modes.map((m) => MODE_ICON[m]).join("")}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selected && <BookingModal slot={selected.slot} day={selected.day} tz={tz} onClose={() => setSelected(null)} />}
    </div>
  );
}

function BookingModal({ slot, day, tz, onClose }: { slot: SlotInfo; day: DayInfo; tz: string; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const both = slot.modes.length > 1;
  const [pref, setPref] = useState<"any" | MeetingMode>(both ? "any" : slot.modes[0]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await createBooking({ startsAt: slot.iso, name, email, notes, preferredMode: pref });
      if (res.ok) router.push(`/book/confirmed/${res.id}`);
      else setError(res.error);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/40 p-4 sm:items-center" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="card w-full max-w-md p-6">
        <div className="mb-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-amber-800">Book a coffee chat</div>
          <div className="mt-1 text-lg font-semibold text-stone-900">{day.weekday}, {day.date}</div>
          <div className="text-stone-600">{slotRangeLabel(slot.startMin)} {tz}</div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="bk-name">Your name</label>
            <input id="bk-name" className="input" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </div>
          <div>
            <label className="label" htmlFor="bk-email">Email</label>
            <input id="bk-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@school.edu" />
            <p className="mt-1 text-xs text-stone-500">The calendar invite goes here.</p>
          </div>
          <div>
            <span className="label">Format</span>
            {both ? (
              <div className="flex gap-2">
                {(["any", "in_person", "virtual"] as const).map((m) => (
                  <button
                    type="button"
                    key={m}
                    onClick={() => setPref(m)}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm ${pref === m ? "border-amber-700 bg-amber-50 text-amber-900" : "border-stone-300 text-stone-700 hover:bg-stone-50"}`}
                  >
                    {m === "any" ? "No preference" : `${MODE_ICON[m]} ${MODE_LABEL[m]}`}
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700">
                {MODE_ICON[slot.modes[0]]} {MODE_LABEL[slot.modes[0]]}
              </div>
            )}
          </div>
          <div>
            <label className="label" htmlFor="bk-notes">What would you like to chat about? <span className="font-normal normal-case text-stone-400">(optional)</span></label>
            <textarea id="bk-notes" className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Recruiting, what the club is like, your major…" />
          </div>
        </div>

        {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={pending}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={pending}>{pending ? "Booking…" : "Confirm booking"}</button>
        </div>
      </form>
    </div>
  );
}
