// Central knobs for the club. Edit these to change behavior.

export const CLUB_NAME = "ALI";
export const APP_TITLE = `${CLUB_NAME} Coffee Chats`;

// All scheduling is done in this timezone.
export const TIMEZONE = "America/New_York";

// Chats are fixed-length slots.
export const SLOT_MINUTES = 30;

// The member availability grid spans these hours (24h, in TIMEZONE).
export const DAY_START_HOUR = 8;
export const DAY_END_HOUR = 22;

// Chats run only within this date range (inclusive, in TIMEZONE). Students cannot book outside it.
export const BOOKING_WINDOW_START = "2026-09-07";
export const BOOKING_WINDOW_END = "2026-09-19";

// A slot must start at least this many minutes from now to be bookable.
export const MIN_LEAD_MINUTES = 60;

// One active (upcoming, confirmed) booking per student email.
export const MAX_ACTIVE_BOOKINGS_PER_STUDENT = 1;

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export type MeetingMode = "in_person" | "virtual";
