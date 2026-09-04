"use server";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { currentMember } from "@/auth";
import { getDb, schema } from "@/db";

async function requireAdmin() {
  const me = await currentMember();
  if (!me?.isAdmin) throw new Error("Admins only");
  return me;
}

export async function addMember(form: FormData): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const name = String(form.get("name") ?? "").trim().slice(0, 100);
  const title = String(form.get("title") ?? "").trim().slice(0, 100);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Enter a valid email." };
  const db = await getDb();
  const existing = await db.query.members.findFirst({ where: eq(schema.members.email, email) });
  if (existing) {
    await db.update(schema.members).set({ active: true, name: name || existing.name, title: title || existing.title }).where(eq(schema.members.id, existing.id));
  } else {
    await db.insert(schema.members).values({ id: randomUUID(), email, name, title });
  }
  revalidatePath("/admin");
  return { ok: true };
}

export async function setMemberActive(id: string, active: boolean) {
  const me = await requireAdmin();
  if (id === me.id && !active) return { ok: false, error: "You cannot deactivate yourself." };
  const db = await getDb();
  await db.update(schema.members).set({ active }).where(eq(schema.members.id, id));
  revalidatePath("/admin");
  revalidatePath("/");
  return { ok: true };
}

export async function setMemberAdmin(id: string, isAdmin: boolean) {
  const me = await requireAdmin();
  if (id === me.id && !isAdmin) return { ok: false, error: "You cannot remove your own admin role." };
  const db = await getDb();
  await db.update(schema.members).set({ isAdmin }).where(eq(schema.members.id, id));
  revalidatePath("/admin");
  return { ok: true };
}

export async function removeMember(id: string) {
  const me = await requireAdmin();
  if (id === me.id) return { ok: false, error: "You cannot remove yourself." };
  const db = await getDb();
  await db.delete(schema.members).where(eq(schema.members.id, id));
  revalidatePath("/admin");
  revalidatePath("/");
  return { ok: true };
}
