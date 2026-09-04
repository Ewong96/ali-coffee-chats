"use server";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { currentMember } from "@/auth";
import { getDb, schema } from "@/db";
import { deleteEvent } from "@/lib/google";
import { DAY_END_HOUR, DAY_START_HOUR, SLOT_MINUTES } from "@/lib/config";

export type RuleInput = { weekday: number; startMin: number; mode: "in_person" | "virtual" | null };

function validSlot(weekday: number, startMin: number) {
  return (
    Number.isInteger(weekday) && weekday >= 0 && weekday <= 6 &&
    Number.isInteger(startMin) && startMin >= DAY_START_HOUR * 60 && startMin < DAY_END_HOUR * 60 && startMin % SLOT_MINUTES === 0
  );
}
const modeOrNull = (m: unknown) => (m === "in_person" || m === "virtual" ? m : null);

async function requireMember() {
  const me = await currentMember();
  if (!me) throw new Error("Not signed in");
  return me;
}

export async function saveRules(rules: RuleInput[]): Promise<{ ok: boolean }> {
  const me = await requireMember();
  const db = await getDb();
  const clean = rules.filter((r) => validSlot(r.weekday, r.startMin));
  await db.transaction(async (tx) => {
    await tx.delete(schema.availabilityRules).where(eq(schema.availabilityRules.memberId, me.id));
    if (clean.length) {
      await tx.insert(schema.availabilityRules).values(
        clean.map((r) => ({ id: randomUUID(), memberId: me.id, weekday: r.weekday, startMin: r.startMin, mode: modeOrNull(r.mode) })),
      );
    }
  });
  revalidatePath("/");
  revalidatePath("/member");
  return { ok: true };
}

export async function saveProfile(form: FormData): Promise<{ ok: boolean; error?: string }> {
  const me = await requireMember();
  const db = await getDb();
  const s = (k: string, max = 200) => String(form.get(k) ?? "").trim().slice(0, max);
  const defaultMode = form.get("defaultMode") === "virtual" ? "virtual" : "in_person";
  await db
    .update(schema.members)
    .set({
      name: s("name", 100),
      title: s("title", 100),
      bio: s("bio", 500),
      defaultMode,
      location: s("location", 300),
      virtualLink: s("virtualLink", 500),
      checkGoogleBusy: form.get("checkGoogleBusy") === "on",
    })
    .where(eq(schema.members.id, me.id));
  revalidatePath("/");
  revalidatePath("/member");
  return { ok: true };
}

/** kind = null clears the exception for that date/slot. */
export async function setException(date: string, startMin: number, kind: "block" | "open" | null, mode: "in_person" | "virtual" | null = null) {
  const me = await requireMember();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !validSlot(0, startMin)) throw new Error("Invalid slot");
  const db = await getDb();
  const where = and(eq(schema.availabilityExceptions.memberId, me.id), eq(schema.availabilityExceptions.date, date), eq(schema.availabilityExceptions.startMin, startMin));
  await db.delete(schema.availabilityExceptions).where(where);
  if (kind) {
    await db.insert(schema.availabilityExceptions).values({ id: randomUUID(), memberId: me.id, date, startMin, kind, mode: modeOrNull(mode) });
  }
  revalidatePath("/");
  revalidatePath("/member");
  return { ok: true };
}

export async function cancelBooking(id: string): Promise<{ ok: boolean; error?: string }> {
  const me = await requireMember();
  const db = await getDb();
  const b = await db.query.bookings.findFirst({ where: eq(schema.bookings.id, id) });
  if (!b || (b.memberId !== me.id && !me.isAdmin)) return { ok: false, error: "Not found" };
  if (b.status !== "confirmed") return { ok: true };
  const host = b.memberId === me.id ? me : await db.query.members.findFirst({ where: eq(schema.members.id, b.memberId) });
  if (b.googleEventId && host?.googleRefreshToken) {
    try {
      await deleteEvent(host.googleRefreshToken, b.googleEventId);
    } catch (err) {
      console.error("deleteEvent failed", err);
      return { ok: false, error: "Could not remove the calendar event. Try again, or delete it from Google Calendar directly." };
    }
  }
  await db.update(schema.bookings).set({ status: "cancelled", cancelledAt: new Date() }).where(eq(schema.bookings.id, id));
  revalidatePath("/");
  revalidatePath("/member");
  revalidatePath("/admin");
  return { ok: true };
}
