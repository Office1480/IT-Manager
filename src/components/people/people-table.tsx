"use client";
import { useDeferredValue, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { LayoutGrid, List, Search, Users } from "lucide-react";
import type { EmployeeStatus } from "@prisma/client";
import { Link, useRouter } from "@/i18n/routing";
import { Avatar } from "@/components/ui/avatar";
import { Input, Select } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { EmptyState, Table, Td, Th } from "@/components/ui/misc";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EmployeeStatusBadge } from "./status-badge";

export type PersonRow = {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string | null;
  status: EmployeeStatus;
  startDate: Date | null;
  department: { id: string; name: string; color: string } | null;
  manager: { id: string; firstName: string; lastName: string } | null;
};

export function PeopleTable({ rows, departments }: { rows: PersonRow[]; departments: { id: string; name: string }[] }) {
  const t = useTranslations("people");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("current");
  const [dep, setDep] = useState("");
  const [view, setView] = useState<"list" | "grid">("list");
  const dq = useDeferredValue(q);

  const filtered = useMemo(() => {
    const needle = dq.trim().toLowerCase();
    return rows.filter((r) => {
      if (status === "current" && r.status === "OFFBOARDED") return false;
      if (status !== "current" && status !== "all" && r.status !== status) return false;
      if (dep && r.department?.id !== dep) return false;
      if (!needle) return true;
      return `${r.firstName} ${r.lastName} ${r.email} ${r.jobTitle ?? ""} ${r.employeeNumber}`.toLowerCase().includes(needle);
    });
  }, [rows, dq, status, dep]);

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-subtle" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchPlaceholder")} className="ps-8" />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto">
          <option value="current">{t("status.ACTIVE")} + {t("status.ONBOARDING")}</option>
          <option value="all">{tc("all")}</option>
          {(["ONBOARDING", "ACTIVE", "OFFBOARDING", "OFFBOARDED"] as const).map((s) => (
            <option key={s} value={s}>
              {t(`status.${s}`)}
            </option>
          ))}
        </Select>
        <Select value={dep} onChange={(e) => setDep(e.target.value)} className="w-auto">
          <option value="">{t("fields.department")} : {tc("all")}</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
        <div className="flex rounded-lg border border-border p-0.5">
          {(["list", "grid"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className={cn("rounded-md p-1.5 text-fg-subtle", view === v && "bg-surface-hover text-fg")} aria-label={v}>
              {v === "list" ? <List className="size-4" /> : <LayoutGrid className="size-4" />}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Users />} title={rows.length ? tc("noResults") : t("empty")} description={rows.length ? undefined : t("emptyHint")} />
      ) : view === "list" ? (
        <Table>
          <thead>
            <tr>
              <Th>{t("columns.name")}</Th>
              <Th>{t("columns.job")}</Th>
              <Th>{t("columns.department")}</Th>
              <Th className="hidden md:table-cell">{t("columns.manager")}</Th>
              <Th className="hidden md:table-cell">{t("columns.startDate")}</Th>
              <Th>{t("columns.status")}</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} onClick={() => router.push(`/people/${r.id}`)} className="cursor-pointer transition-colors hover:bg-surface-hover">
                <Td>
                  <div className="flex items-center gap-2.5">
                    <Avatar id={r.id} firstName={r.firstName} lastName={r.lastName} size={30} />
                    <div className="min-w-0">
                      <Link href={`/people/${r.id}`} onClick={(e) => e.stopPropagation()} className="block font-medium hover:underline">
                        {r.firstName} {r.lastName}
                      </Link>
                      <div className="text-xs text-fg-subtle">{r.email}</div>
                    </div>
                  </div>
                </Td>
                <Td className="text-fg-muted">{r.jobTitle ?? "—"}</Td>
                <Td>
                  {r.department ? (
                    <span className="inline-flex items-center gap-1.5 text-fg-muted">
                      <span className="size-2 rounded-full" style={{ background: r.department.color }} />
                      {r.department.name}
                    </span>
                  ) : (
                    "—"
                  )}
                </Td>
                <Td className="hidden text-fg-muted md:table-cell">{r.manager ? `${r.manager.firstName} ${r.manager.lastName}` : "—"}</Td>
                <Td className="hidden text-fg-muted tabular md:table-cell">{fmtDate(r.startDate, locale)}</Td>
                <Td>
                  <EmployeeStatusBadge status={r.status} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((r) => (
            <Link key={r.id} href={`/people/${r.id}`} className="group flex flex-col items-center rounded-xl border border-border p-5 text-center transition-all hover:border-border-strong hover:shadow-md">
              <Avatar id={r.id} firstName={r.firstName} lastName={r.lastName} size={56} />
              <div className="mt-3 font-medium">
                {r.firstName} {r.lastName}
              </div>
              <div className="mt-0.5 text-xs text-fg-subtle">{r.jobTitle ?? "—"}</div>
              <div className="mt-3 flex items-center gap-2">
                {r.department && (
                  <span className="inline-flex items-center gap-1 text-xs text-fg-muted">
                    <span className="size-1.5 rounded-full" style={{ background: r.department.color }} />
                    {r.department.name}
                  </span>
                )}
                <EmployeeStatusBadge status={r.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}
