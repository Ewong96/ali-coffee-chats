import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const members = pgTable("members", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull().default(""),
  title: text("title").notNull().default(""), // e.g. "President", "VP of Events"
  bio: text("bio").notNull().default(""),
  image: text("image"),
  isAdmin: boolean("is_admin").notNull().default(false),
  active: boolean("active").notNull().default(true),
  // Meeting defaults
  defaultMode: text("default_mode").notNull().default("in_person"), // in_person | virtual
  location: text("location").notNull().default(""), // for in-person
  virtualLink: text("virtual_link").notNull().default(""), // Zoom etc. Empty => auto Google Meet
  checkGoogleBusy: boolean("check_google_busy").notNull().default(true),
  // Comma-separated class years this member will chat with (see CLASS_YEARS in config).
  acceptedYears: text("accepted_years").notNull().default("freshman,sophomore,junior,senior"),
  // Google OAuth
  googleRefreshToken: text("google_refresh_token"),
  googleConnectedAt: timestamp("google_connected_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Weekly recurring 30-min slots. weekday: 0=Mon ... 6=Sun. startMin: minutes after midnight in TIMEZONE.
export const availabilityRules = pgTable(
  "availability_rules",
  {
    id: text("id").primaryKey(),
    memberId: text("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
    weekday: integer("weekday").notNull(),
    startMin: integer("start_min").notNull(),
    mode: text("mode"), // null => member default
  },
  (t) => [uniqueIndex("rules_member_slot").on(t.memberId, t.weekday, t.startMin)],
);

// Per-date overrides. kind: 'block' removes a recurring slot; 'open' adds a one-off slot.
export const availabilityExceptions = pgTable(
  "availability_exceptions",
  {
    id: text("id").primaryKey(),
    memberId: text("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
    date: text("date").notNull(), // YYYY-MM-DD in TIMEZONE
    startMin: integer("start_min").notNull(),
    kind: text("kind").notNull(), // block | open
    mode: text("mode"),
  },
  (t) => [uniqueIndex("exceptions_member_slot").on(t.memberId, t.date, t.startMin)],
);

export const bookings = pgTable(
  "bookings",
  {
    id: text("id").primaryKey(),
    memberId: text("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
    studentName: text("student_name").notNull(),
    studentEmail: text("student_email").notNull(),
    studentNotes: text("student_notes").notNull().default(""),
    studentYear: text("student_year").notNull().default(""),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    mode: text("mode").notNull(), // in_person | virtual
    location: text("location").notNull().default(""), // address or meeting link
    status: text("status").notNull().default("confirmed"), // confirmed | cancelled
    source: text("source").notNull().default("web"), // web (booked by a student) | manual (logged by the host afterwards)
    googleEventId: text("google_event_id"),
    calendarError: text("calendar_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  },
  (t) => [
    // A member can only hold one confirmed booking per start time.
    uniqueIndex("bookings_member_start_confirmed")
      .on(t.memberId, t.startsAt)
      .where(sql`${t.status} = 'confirmed'`),
    index("bookings_student_email").on(t.studentEmail),
    index("bookings_starts_at").on(t.startsAt),
  ],
);

// One feedback entry per booking, written by the host after the chat.
export const feedback = pgTable(
  "feedback",
  {
    id: text("id").primaryKey(),
    bookingId: text("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
    memberId: text("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
    attended: boolean("attended").notNull().default(true),
    program: text("program").notNull().default(""),
    rating: integer("rating"), // 1-5 fit rating; null if no-show
    notes: text("notes").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("feedback_booking").on(t.bookingId)],
);

export type Member = typeof members.$inferSelect;
export type Feedback = typeof feedback.$inferSelect;
export type AvailabilityRule = typeof availabilityRules.$inferSelect;
export type AvailabilityException = typeof availabilityExceptions.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
