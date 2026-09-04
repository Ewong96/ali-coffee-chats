"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveRules, type RuleInput } from "@/app/actions/member";
import { WEEKDAYS } from "@/lib/config";
import { daySlotStarts, minutesLabel } from "@/lib/time";

type CellState = "off" | "default" | "in_person" | "virtual";
type Cells = Map<string, CellState>;
const CYCLE: CellState[] = ["off", "default", "in_person", "virtual"];
const next = (s: CellState) => CYCLE[(CYCLE.indexOf(s) + 1) % CYCLE.length];
const key = (wd: number, min: number) => `${wd}|${min}`;

const CELL_CLASS: Record<CellState, string> = {
  off: "bg-white hover:bg-stone-100",
  default: "bg-amber-500 hover:bg-amber-600",
  in_person: "bg-emerald-500 hover:bg-emerald-600",
  virtual: "bg-sky-500 hover:bg-sky-600",
};

type Drag = { base: Cells; state: CellState; startCol: number; startRow: number };

export default function AvailabilityGrid({ initialRules, defaultMode }: { initialRules: RuleInput[]; defaultMode: "in_person" | "virtual" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const starts = useMemo(() => daySlotStarts(), []);
  const initial = useMemo(() => {
    const m: Cells = new Map();
    for (const r of initialRules) m.set(key(r.weekday, r.startMin), r.mode ?? "default");
    return m;
  }, [initialRules]);
  const [cells, setCells] = useState<Cells>(initial);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const firstCellRef = useRef<HTMLButtonElement>(null);
  const drag = useRef<Drag | null>(null);

  /** Map a pointer position to a (col,row) cell using the first cell's geometry, so fast drags never skip cells. */
  const cellAt = useCallback(
    (x: number, y: number): [number, number] | null => {
      const first = firstCellRef.current?.getBoundingClientRect();
      if (!first || first.width === 0) return null;
      const col = Math.floor((x - first.left) / first.width);
      const row = Math.floor((y - first.top) / first.height);
      return [Math.max(0, Math.min(6, col)), Math.max(0, Math.min(starts.length - 1, row))];
    },
    [starts.length],
  );

  const applyRect = useCallback(
    (col: number, row: number) => {
      const d = drag.current;
      if (!d) return;
      const n: Cells = new Map(d.base);
      const [c0, c1] = [Math.min(d.startCol, col), Math.max(d.startCol, col)];
      const [r0, r1] = [Math.min(d.startRow, row), Math.max(d.startRow, row)];
      for (let c = c0; c <= c1; c++) {
        for (let r = r0; r <= r1; r++) {
          const k = key(c, starts[r]);
          if (d.state === "off") n.delete(k);
          else n.set(k, d.state);
        }
      }
      setCells(n);
      setDirty(true);
    },
    [starts],
  );

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!drag.current) return;
      const cell = cellAt(e.clientX, e.clientY);
      if (cell) applyRect(cell[0], cell[1]);
    };
    const up = () => (drag.current = null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [cellAt, applyRect]);

  function onPointerDown(e: React.PointerEvent, col: number, row: number) {
    if (e.button !== 0) return;
    e.preventDefault();
    const current = cells.get(key(col, starts[row])) ?? "off";
    drag.current = { base: cells, state: next(current), startCol: col, startRow: row };
    applyRect(col, row);
  }

  function save() {
    start(async () => {
      const rules: RuleInput[] = [];
      for (const [k, s] of cells) {
        const [wd, min] = k.split("|").map(Number);
        rules.push({ weekday: wd, startMin: min, mode: s === "in_person" || s === "virtual" ? s : null });
      }
      await saveRules(rules);
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    });
  }

  const count = cells.size;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-600">
        <Legend cls="bg-amber-500" label={`Open (${defaultMode === "in_person" ? "in person" : "virtual"}, your default)`} />
        <Legend cls="bg-emerald-500" label="In person only" />
        <Legend cls="bg-sky-500" label="Virtual only" />
      </div>

      <div className="overflow-x-auto select-none">
        <div ref={gridRef} className="grid min-w-[560px] touch-none" style={{ gridTemplateColumns: "4.5rem repeat(7, minmax(0, 1fr))" }}>
          <div />
          {WEEKDAYS.map((d) => (
            <div key={d} className="pb-2 text-center text-xs font-semibold uppercase tracking-wide text-stone-500">{d}</div>
          ))}
          {starts.map((min, row) => {
            const hour = min % 60 === 0;
            return (
              <FragmentRow key={min}>
                <div className={`pr-2 text-right text-[11px] leading-7 text-stone-500 ${hour ? "" : "invisible"}`}>{minutesLabel(min)}</div>
                {Array.from({ length: 7 }, (_, col) => {
                  const s = cells.get(key(col, min)) ?? "off";
                  return (
                    <button
                      key={col}
                      ref={col === 0 && row === 0 ? firstCellRef : undefined}
                      type="button"
                      title={`${WEEKDAYS[col]} ${minutesLabel(min)}`}
                      className={`h-7 border-r border-b border-stone-200 transition-colors ${col === 0 ? "border-l" : ""} ${hour ? "border-t border-t-stone-300" : ""} ${CELL_CLASS[s]}`}
                      onPointerDown={(e) => onPointerDown(e, col, row)}
                    />
                  );
                })}
              </FragmentRow>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button className="btn-primary" onClick={save} disabled={pending || !dirty}>{pending ? "Saving…" : "Save availability"}</button>
        <button className="btn-secondary" onClick={() => { setCells(new Map()); setDirty(true); }} disabled={pending || count === 0}>Clear all</button>
        <span className="text-sm text-stone-500">{count} slot{count === 1 ? "" : "s"} per week{dirty ? " · unsaved changes" : ""}</span>
        {saved && <span className="text-sm text-emerald-700">Saved</span>}
      </div>
    </div>
  );
}

function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5"><span className={`inline-block h-3 w-3 rounded-sm ${cls}`} />{label}</span>
  );
}
