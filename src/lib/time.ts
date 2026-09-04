import { DateTime } from "luxon";
import { TIMEZONE, SLOT_MINUTES, DAY_START_HOUR, DAY_END_HOUR, BOOKING_WINDOW_START, BOOKING_WINDOW_END } from "./config";

export const now = () => DateTime.now().setZone(TIMEZONE);

/** 'YYYY-MM-DD' for a DateTime in the club timezone. */
export const toDateKey = (dt: DateTime) => dt.setZone(TIMEZONE).toISODate()!;

/** Luxon weekday is 1=Mon..7=Sun; we use 0=Mon..6=Sun. */
export const weekdayIndex = (dt: DateTime) => dt.setZone(TIMEZONE).weekday - 1;

/** Build an instant from a date key + minutes-after-midnight in the club timezone. */
export function slotInstant(dateKey: string, startMin: number): DateTime {
  return DateTime.fromISO(dateKey, { zone: TIMEZONE }).plus({ minutes: startMin });
}

export function minutesLabel(startMin: number): string {
  const h = Math.floor(startMin / 60);
  const m = startMin % 60;
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12} ${suffix}` : `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function slotRangeLabel(startMin: number): string {
  return `${minutesLabel(startMin)} – ${minutesLabel(startMin + SLOT_MINUTES)}`;
}

/** All slot start minutes in a day, from the config window. */
export function daySlotStarts(): number[] {
  const out: number[] = [];
  for (let m = DAY_START_HOUR * 60; m < DAY_END_HOUR * 60; m += SLOT_MINUTES) out.push(m);
  return out;
}

export function fmtDateLong(dt: DateTime | Date): string {
  const d = dt instanceof Date ? DateTime.fromJSDate(dt) : dt;
  return d.setZone(TIMEZONE).toFormat("cccc, LLLL d");
}

export function fmtTime(dt: DateTime | Date): string {
  const d = dt instanceof Date ? DateTime.fromJSDate(dt) : dt;
  return d.setZone(TIMEZONE).toFormat("h:mm a");
}

export function fmtDateTime(dt: DateTime | Date): string {
  const d = dt instanceof Date ? DateTime.fromJSDate(dt) : dt;
  return d.setZone(TIMEZONE).toFormat("ccc, LLL d 'at' h:mm a");
}

export function tzAbbrev(dt?: DateTime | Date): string {
  const d = dt ? (dt instanceof Date ? DateTime.fromJSDate(dt) : dt) : now();
  return d.setZone(TIMEZONE).toFormat("ZZZZ");
}

/** The bookable window: [start, end) as instants in the club timezone. */
export function bookingWindow(): { start: DateTime; end: DateTime } {
  return {
    start: DateTime.fromISO(BOOKING_WINDOW_START, { zone: TIMEZONE }).startOf("day"),
    end: DateTime.fromISO(BOOKING_WINDOW_END, { zone: TIMEZONE }).startOf("day").plus({ days: 1 }),
  };
}

export function fmtWindow(): string {
  const { start, end } = bookingWindow();
  const last = end.minus({ days: 1 });
  const sameMonth = start.month === last.month;
  return sameMonth ? `${start.toFormat("LLLL d")}–${last.toFormat("d")}` : `${start.toFormat("LLL d")} – ${last.toFormat("LLL d")}`;
}
