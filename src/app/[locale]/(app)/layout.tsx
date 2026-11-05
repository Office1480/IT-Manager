import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/rbac";
import { requireContext } from "@/server/context";
import { Sidebar } from "@/components/shell/sidebar";
import { MobileNav } from "@/components/shell/mobile-nav";
import { CommandPalette, type PaletteEntity } from "@/components/shell/command-palette";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireContext();
  const permissions = PERMISSIONS.filter((p) => ctx.can(p));

  const [employees, projects, assets] = await Promise.all([
    db.employee.findMany({
      where: { organizationId: ctx.orgId, deletedAt: null },
      select: { id: true, firstName: true, lastName: true, jobTitle: true },
      orderBy: { lastName: "asc" },
    }),
    db.project.findMany({ where: { organizationId: ctx.orgId }, select: { id: true, name: true, key: true } }),
    ctx.can("asset.read")
      ? db.asset.findMany({ where: { organizationId: ctx.orgId }, select: { id: true, assetTag: true, brand: true, model: true, serialNumber: true } })
      : Promise.resolve([]),
  ]);

  const entities: PaletteEntity[] = [
    ...employees.map((e) => ({ id: e.id, type: "employee" as const, title: `${e.firstName} ${e.lastName}`, subtitle: e.jobTitle, href: `/people/${e.id}`, firstName: e.firstName, lastName: e.lastName })),
    ...projects.map((p) => ({ id: p.id, type: "project" as const, title: p.name, subtitle: p.key, href: `/projects/${p.id}` })),
    ...assets.map((a) => ({ id: a.id, type: "asset" as const, title: `${a.brand} ${a.model}`, subtitle: `${a.assetTag} · ${a.serialNumber}`, href: `/assets/${a.id}` })),
  ];

  const user = { name: ctx.user.name, email: ctx.user.email, role: ctx.role, employeeId: ctx.employeeId };

  return (
    <div className="flex min-h-dvh">
      <Sidebar orgName={ctx.org.name} permissions={permissions} user={user} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav orgName={ctx.org.name} permissions={permissions} user={user} />
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</main>
      </div>
      <CommandPalette entities={entities} />
    </div>
  );
}
