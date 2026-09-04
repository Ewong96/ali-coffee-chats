CREATE TABLE "availability_exceptions" (
	"id" text PRIMARY KEY NOT NULL,
	"member_id" text NOT NULL,
	"date" text NOT NULL,
	"start_min" integer NOT NULL,
	"kind" text NOT NULL,
	"mode" text
);
--> statement-breakpoint
CREATE TABLE "availability_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"member_id" text NOT NULL,
	"weekday" integer NOT NULL,
	"start_min" integer NOT NULL,
	"mode" text
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" text PRIMARY KEY NOT NULL,
	"member_id" text NOT NULL,
	"student_name" text NOT NULL,
	"student_email" text NOT NULL,
	"student_notes" text DEFAULT '' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"mode" text NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"google_event_id" text,
	"calendar_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"image" text,
	"is_admin" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"default_mode" text DEFAULT 'in_person' NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"virtual_link" text DEFAULT '' NOT NULL,
	"check_google_busy" boolean DEFAULT true NOT NULL,
	"google_refresh_token" text,
	"google_connected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "members_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "availability_exceptions" ADD CONSTRAINT "availability_exceptions_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_rules" ADD CONSTRAINT "availability_rules_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "exceptions_member_slot" ON "availability_exceptions" USING btree ("member_id","date","start_min");--> statement-breakpoint
CREATE UNIQUE INDEX "rules_member_slot" ON "availability_rules" USING btree ("member_id","weekday","start_min");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_member_start_confirmed" ON "bookings" USING btree ("member_id","starts_at") WHERE "bookings"."status" = 'confirmed';--> statement-breakpoint
CREATE INDEX "bookings_student_email" ON "bookings" USING btree ("student_email");--> statement-breakpoint
CREATE INDEX "bookings_starts_at" ON "bookings" USING btree ("starts_at");