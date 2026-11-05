import { getTranslations, setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireContext } from "@/server/context";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader, Table, Td, Th } from "@/components/ui/misc";
import { fmtDate } from "@/lib/format";

export default async function AuditPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireContext("audit.read");
  const t = await getTranslations("audit");
  const logs = await db.auditLog.findMany({ where: { organizationId: ctx.orgId }, orderBy: { createdAt: "desc" }, take: 300 });
  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <Card>
        <Table>
          <thead>
            <tr><Th>{t("date")}</Th><Th>{t("actor")}</Th><Th>{t("action")}</Th><Th>{t("entity")}</Th></tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <Td className="text-fg-muted tabular">{fmtDate(l.createdAt, locale, { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Jerusalem" })}</Td>
                <Td className="font-medium">{l.actorName ?? "—"}</Td>
                <Td><Badge tone={l.action.endsWith("view") ? "neutral" : l.action.includes("delete") || l.action.includes("archive") ? "danger" : "accent"}>{l.action}</Badge></Td>
                <Td className="max-w-md truncate text-fg-muted">{l.entityType}{l.metadata ? ` · ${JSON.stringify(l.metadata)}` : ""}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
