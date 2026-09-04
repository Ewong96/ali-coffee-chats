"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DateTime } from "luxon";
import { setException } from "@/app/actions/member";
import { BOOKING_WINDOW_END, BOOKING_WINDOW_START, TIMEZONE } from "@/lib/config";
import { daySlotStarts, minutesLabel } from "@/lib/time";

type Rule = { weekday: number; startMin: number };
type Exc = { date: string; startMin: number; kind: "block" | "open" };

export default function ExceptionsEditor({ rules, exceptions, today }: { rules: Rule[]; exceptions: Exc[]; today: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const minDate = today > BOOKING_WINDOW_START ? today : BOOKING_WINDOW_START;
  const maxDate = BOOKING_WINDOW_END;
  const [date, setDate] = useState(minDate <= maxDate ? minDate : today);

  const dt = DateTime.fromISO(date, { zone: TIMEZONE });
  const weekday = dt.isValid ? dt.weekday - 1 : -1;
  const ruleSet = useMemo(() => new Set(rules.filter((r) => r.weekday === weekday).map((r) => r.startMin)), [rules, weekday]);
  const excMap = useMemo(() => new Map(exceptions.filter((e) => e.date === date).map((e) => [e.startMin, e.kind])), [exceptions, date]);

  function toggle(min: number) {
    const recurring = ruleSet.has(min);
    const current = excMap.get(min);
    let kind: "block" | "open" | null;
    if (recurring) kind = current === "block" ? null : "block";
    else kind = current === "open" ? null : "open";
    start(async () => {
      await setException(date, min, kind);
      router.refresh();
    });
  }

  const upcoming = exceptions.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date) || a.startMin - b.startMin);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="ex-date">Date</label>
          <input id="ex-date" type="date" className="input w-auto" value={date} min={minDate} max={maxDate} onChange={(e) => setDate(e.target.value)} />
        </div>
        {dt.isValid && <span className="pb-2 text-sm text-stone-600">{dt.toFormat("cccc, LLLL d")}</span>}
      </div>

      {dt.isValid && (
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
          {daySlotStarts().map((min) => {
            const recurring = ruleSet.has(min);
            const exc = excMap.get(min);
            const open = (recurring && exc !== "block") || exc === "open";
            let cls = "border-stone-200 bg-white text-stone-500 hover:bg-stone-50";
            let tag = "";
            if (open && exc === "open") { cls = "border-emerald-300 bg-emerald-50 text-emerald-900"; tag = "one-off"; }
            else if (open) { cls = "border-amber-300 bg-amber-50 text-amber-900"; tag = "weekly"; }
            else if (exc === "block") { cls = "border-red-300 bg-red-50 text-red-800 line-through"; tag = "blocked"; }
            return (
              <button key={min} type="button" disabled={pending} onClick={() => toggle(min)} className={`rounded-md border px-2 py-1.5 text-left text-xs transition ${cls}`}>
                <div className="font-medium">{minutesLabel(min)}</div>
                <div className="text-[10px] opacity-70">{tag || "closed"}</div>
              </button>
            );
          })}
        </div>
      )}
      <p className="text-xs text-stone-500">Click a weekly slot to block it for this date only, or click a closed slot to open it just for this date.</p>

      {upcoming.length > 0 && (
        <div>
          <div className="label">Upcoming overrides</div>
          <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200 text-sm">
            {upcoming.map((e) => (
              <li key={`${e.date}|${e.startMin}`} className="flex items-center justify-between px-3 py-2">
                <span>
                  <span className="text-stone-800">{DateTime.fromISO(e.date, { zone: TIMEZONE }).toFormat("ccc, LLL d")}</span>
                  <span className="text-stone-500"> · {minutesLabel(e.startMin)} · </span>
                  <span className={e.kind === "block" ? "text-red-700" : "text-emerald-700"}>{e.kind === "block" ? "blocked" : "opened"}</span>
                </span>
                <button type="button" className="text-xs text-stone-500 hover:text-stone-900" disabled={pending} onClick={() => start(async () => { await setException(e.date, e.startMin, null); router.refresh(); })}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
