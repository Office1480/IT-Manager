"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, destroySession } from "@/lib/session";

const schema = z.object({ email: z.string().email(), password: z.string().min(1), next: z.string().optional() });

export async function loginAction(_: { error?: string } | undefined, formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const { email, password, next } = parsed.data;
  const user = await db.user.findUnique({ where: { email: email.toLowerCase() }, include: { memberships: { orderBy: { createdAt: "asc" } } } });
  // Comparaison toujours effectuée pour éviter l'énumération par timing.
  const ok = await bcrypt.compare(password, user?.passwordHash ?? "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv");
  if (!user || !ok || user.memberships.length === 0) return { error: "invalid" };
  await createSession({ uid: user.id, oid: user.memberships[0].organizationId });
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const locale = user.locale ?? (await getLocale());
  redirect(next && next.startsWith("/") && !next.startsWith("//") ? next : `/${locale}`);
}

export async function logoutAction() {
  await destroySession();
  redirect(`/${await getLocale()}/login`);
}
