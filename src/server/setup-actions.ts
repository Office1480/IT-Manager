"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { createSession } from "@/lib/session";
import { ensureOrgSetup } from "./setup";

/** Première installation : uniquement possible tant qu'aucun utilisateur n'existe. */
export async function setupAction(_: { error?: string } | undefined, fd: FormData) {
  if ((await db.user.count()) > 0) return { error: "already" };
  const org = String(fd.get("orgName") ?? "").trim();
  const name = String(fd.get("name") ?? "").trim();
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (!org || !name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) return { error: "invalid" };
  const locale = await getLocale();
  const slug = org.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "org";
  const [first, ...rest] = name.split(" ");
  const created = await db.organization.create({ data: { name: org, slug: `${slug}-${Date.now().toString(36)}`, locale } });
  await ensureOrgSetup(created.id);
  const employee = await db.employee.create({
    data: { organizationId: created.id, employeeNumber: "0001", firstName: first, lastName: rest.join(" ") || "-", email, jobTitle: "CEO", startDate: new Date(), status: "ACTIVE" },
  });
  const user = await db.user.create({
    data: { email, name, passwordHash: await bcrypt.hash(password, 10), locale, memberships: { create: { organizationId: created.id, role: "OWNER", employeeId: employee.id } } },
  });
  await createSession({ uid: user.id, oid: created.id });
  redirect(`/${locale}`);
}
