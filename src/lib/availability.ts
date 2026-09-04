import { DateTime } from "luxon";
import { and, eq, gte, inArray, lt } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Member } from "@/db/schema";
import { MIN_LEAD_MINUTES, SLOT_MINUTES, type MeetingMode } from "./config";
import { freeBusy, type BusyInterval } from "./google";
import { bookingWindow, now, slotInstant, toDateKey, weekdayIndex } from "./time";

export type Candidate = { memberId: string; mode: MeetingMode };
export type OpenSlot = {
  startsAt: Date;
  dateKey: string;
  startMin: number;
  candidates: Candidate[];
};

export function effectiveMode(member: Member, override: string | null | undefined): MeetingMode {
  const m = override ?? member.defaultMode;
  return m === "virtual" ? "virtual" : "in_person";
}

/** Human-readable place for a booking, before any Meet link is generated. */
export function locationFor(member: Member, mode: MeetingMode): string {
  if (mode === "in_person") return member.location || "Location to be shared by your host";
  return member.virtualLink || ""; // empty => Google Meet will be created
}

function overlapsBusy(start: Date, end: Date, busy: BusyInterval[]): boolean {
  return busy.some((b) => b.start < end && b.end > start);
}

/** Members eligible to take chats: active and connected to Google Calendar. */
export async function bookableMembers(): Promise<Member[]> {
  const db = await getDb();
  const all = await db.query.members.findMany({ where: eq(schema.members.active, true) });
  return all.filter((m) => !!m.googleRefreshToken);
}

/**
 * Every open slot across all bookable members between rangeStart (inclusive) and rangeEnd (exclusive).
 * Applies recurring rules, per-date exceptions, existing bookings, lead time, and Google busy blocks.
 */
export async function computeOpenSlots(rangeStart: DateTime, rangeEnd: DateTime): Promise<OpenSlot[]> {
  // Clamp to the booking window so nothing outside it is ever offered.
  const win = bookingWindow();
  if (rangeStart < win.start) rangeStart = win.start;
  if (rangeEnd > win.end) rangeEnd = win.end;
  if (rangeStart >= rangeEnd) return [];
  const db = await getDb();
  const members = await bookableMembers();
  if (!members.length) return [];
  const memberIds = members.map((m) => m.id);
  const startKey = toDateKey(rangeStart);
  const endKey = toDateKey(rangeEnd);

  const [rules, exceptions, booked] = await Promise.all([
    db.query.availabilityRules.findMany({ where: inArray(schema.availabilityRules.memberId, memberIds) }),
    db.query.availabilityExceptions.findMany({
      where: and(
        inArray(schema.availabilityExceptions.memberId, memberIds),
        gte(schema.availabilityExceptions.date, startKey),
        lt(schema.availabilityExceptions.date, endKey),
      ),
    }),
    db.query.bookings.findMany({
      where: and(
        eq(schema.bookings.status, "confirmed"),
        gte(schema.bookings.startsAt, rangeStart.toJSDate()),
        lt(schema.bookings.startsAt, rangeEnd.toJSDate()),
      ),
      columns: { memberId: true, startsAt: true },
    }),
  ]);

  const busyByMember = new Map<string, BusyInterval[]>();
  await Promise.all(
    members.map(async (m) => {
      if (!m.checkGoogleBusy || !m.googleRefreshToken) return busyByMember.set(m.id, []);
      busyByMember.set(m.id, await freeBusy(m.googleRefreshToken, rangeStart.toJSDate(), rangeEnd.toJSDate()));
    }),
  );

  const bookedKeys = new Set(booked.map((b) => `${b.memberId}|${b.startsAt.getTime()}`));
  const earliest = now().plus({ minutes: MIN_LEAD_MINUTES });

  // Index rules and exceptions
  const rulesBy = new Map<string, Map<number, string | null>>(); // memberId|weekday -> startMin -> mode
  for (const r of rules) {
    const k = `${r.memberId}|${r.weekday}`;
    if (!rulesBy.has(k)) rulesBy.set(k, new Map());
    rulesBy.get(k)!.set(r.startMin, r.mode);
  }
  const excBy = new Map<string, typeof exceptions>(); // memberId|date -> exceptions
  for (const e of exceptions) {
    const k = `${e.memberId}|${e.date}`;
    if (!excBy.has(k)) excBy.set(k, []);
    excBy.get(k)!.push(e);
  }

  const slots = new Map<number, OpenSlot>();
  for (let day = rangeStart.startOf("day"); day < rangeEnd; day = day.plus({ days: 1 })) {
    const dateKey = toDateKey(day);
    const wd = weekdayIndex(day);
    for (const m of members) {
      const daySlots = new Map(rulesBy.get(`${m.id}|${wd}`) ?? []);
      for (const e of excBy.get(`${m.id}|${dateKey}`) ?? []) {
        if (e.kind === "block") daySlots.delete(e.startMin);
        else daySlots.set(e.startMin, e.mode);
      }
      for (const [startMin, modeOverride] of daySlots) {
        const start = slotInstant(dateKey, startMin);
        if (start < earliest || start < rangeStart || start >= rangeEnd) continue;
        const startDate = start.toJSDate();
        const endDate = start.plus({ minutes: SLOT_MINUTES }).toJSDate();
        if (bookedKeys.has(`${m.id}|${startDate.getTime()}`)) continue;
        if (overlapsBusy(startDate, endDate, busyByMember.get(m.id) ?? [])) continue;
        const t = startDate.getTime();
        if (!slots.has(t)) slots.set(t, { startsAt: startDate, dateKey, startMin, candidates: [] });
        slots.get(t)!.candidates.push({ memberId: m.id, mode: effectiveMode(m, modeOverride) });
      }
    }
  }
  return [...slots.values()].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

/** Fresh candidate list for one exact slot start. */
export async function candidatesForSlot(startsAt: Date): Promise<Candidate[]> {
  const start = DateTime.fromJSDate(startsAt);
  const slots = await computeOpenSlots(start, start.plus({ minutes: SLOT_MINUTES }));
  return slots.find((s) => s.startsAt.getTime() === startsAt.getTime())?.candidates ?? [];
}
