import { getTranslations, setRequestLocale } from "next-intl/server";
import { Calendar, ExternalLink, FileCheck2, Globe, Mail, MapPin, Phone, ShieldCheck, Tag } from "lucide-react";
import QRCode from "qrcode";
import { Link } from "@/i18n/routing";
import { requireContext } from "@/server/context";
import { getAsset } from "@/server/assets";
import { employeeOptions, listDocuments } from "@/server/employees";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DescList, EmptyState } from "@/components/ui/misc";
import { AssetStatusBadge, WarrantyBadge } from "@/components/assets/asset-badges";
import { CategoryIcon } from "@/components/assets/category-icon";
import { AssetMenu } from "@/components/assets/asset-menu";
import { AssignDialog, ReturnDialog, SignDialog } from "@/components/assets/assignment-dialogs";
import { DocumentsPanel } from "@/components/documents/documents-panel";
import { fmtDate, fmtMoney } from "@/lib/format";
import { daysUntil } from "@/lib/utils";

export default async function AssetPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const ctx = await requireContext("asset.read");
  const t = await getTranslations("assets");
  const tc = await getTranslations("common");
  const asset = await getAsset(ctx, id);
  const [employees, docs] = await Promise.all([employeeOptions(ctx), listDocuments(ctx, { assetId: id })]);
  const current = asset.assignments.find((a) => !a.returnedAt);
  const name = `${asset.brand} ${asset.model}`;
  const canWrite = ctx.can("asset.write");
  const qr = await QRCode.toString(`${process.env.APP_URL ?? ""}/${locale}/assets/${asset.id}`, { type: "svg", margin: 0, color: { dark: "#18181b", light: "#0000" } });
  const left = daysUntil(asset.warrantyEndDate);
  const money = (v: unknown) => (v == null ? "—" : fmtMoney(v, locale, asset.currency));

  return (
    <div className="space-y-6">
      <div className="text-xs text-fg-subtle"><Link href="/assets" className="hover:text-fg">{t("title")}</Link></div>
      <div className="flex flex-wrap items-start gap-5">
        <span className="flex size-16 items-center justify-center rounded-2xl bg-accent-soft text-accent"><CategoryIcon category={asset.category} className="size-7" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[22px] font-semibold tracking-tight">{name}</h1>
            <AssetStatusBadge status={asset.status} />
            <WarrantyBadge end={asset.warrantyEndDate} />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-fg-muted">
            <span className="inline-flex items-center gap-1.5"><Tag className="size-3.5 text-fg-subtle" />{asset.assetTag}</span>
            <span className="font-mono text-xs">S/N {asset.serialNumber}</span>
            <span>{t(`category.${asset.category}`)}</span>
            {asset.location && <span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5 text-fg-subtle" />{asset.location}</span>}
          </div>
        </div>
        {canWrite && (
          <div className="flex flex-wrap items-center gap-2">
            {current ? (
              <ReturnDialog assignmentId={current.id} assetName={name} holderName={`${current.employee.firstName} ${current.employee.lastName}`} />
            ) : (asset.status === "IN_STOCK" || asset.status === "IN_REPAIR") && (
              <AssignDialog assetId={asset.id} assetName={name} employees={employees} currency={asset.currency} defaultLiability={asset.replacementCost != null ? Number(asset.replacementCost) : asset.purchasePrice != null ? Number(asset.purchasePrice) : null} />
            )}
            <AssetMenu id={asset.id} status={asset.status} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <Card>
            <CardHeader title={t("currentHolder")} />
            <CardBody>
              {current ? (
                <div className="flex flex-wrap items-center gap-4">
                  <Link href={`/people/${current.employee.id}?tab=equipment`} className="flex items-center gap-3">
                    <Avatar id={current.employee.id} firstName={current.employee.firstName} lastName={current.employee.lastName} size={44} />
                    <div>
                      <div className="font-medium">{current.employee.firstName} {current.employee.lastName}</div>
                      <div className="text-xs text-fg-subtle">{current.employee.jobTitle} · {t("since", { date: fmtDate(current.assignedAt, locale) })}</div>
                    </div>
                  </Link>
                  <div className="ms-auto flex flex-wrap items-center gap-3">
                    <div className="text-end">
                      <div className="text-xs text-fg-subtle">{t("liability")}</div>
                      <div className="font-semibold tabular">{money(current.liabilityAmount)}</div>
                    </div>
                    {current.signedAt ? (
                      current.handoverDocId ? (
                        <a href={`/api/files/${current.handoverDocId}?inline=1`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-success-soft px-2.5 py-1.5 text-xs font-medium text-success">
                          <FileCheck2 className="size-4" />{t("signed", { date: fmtDate(current.signedAt, locale) })}
                        </a>
                      ) : <Badge tone="success">{t("signed", { date: fmtDate(current.signedAt, locale) })}</Badge>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Badge tone="warning">{t("pendingSignature")}</Badge>
                        {canWrite && <SignDialog assignmentId={current.id} assetName={name} amount={money(current.liabilityAmount)} signerName={`${current.employee.firstName} ${current.employee.lastName}`} />}
                      </div>
                    )}
                  </div>
                </div>
              ) : <p className="text-[13px] text-fg-subtle">—</p>}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t("sections.purchase")} />
            <CardBody>
              <DescList items={[
                { label: t("fields.purchaseDate"), value: fmtDate(asset.purchaseDate, locale) },
                { label: t("fields.purchasePrice"), value: money(asset.purchasePrice) },
                { label: t("fields.supplier"), value: asset.supplier?.name ?? "—" },
                { label: t("fields.invoiceNumber"), value: asset.invoiceNumber ?? "—" },
                { label: t("fields.replacementCost"), value: money(asset.replacementCost) },
                { label: t("fields.condition"), value: t(`condition.${asset.condition}`) },
                ...(asset.specs ? [{ label: t("fields.specs"), value: asset.specs }] : []),
              ]} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t("history")} />
            {asset.assignments.length === 0 ? <EmptyState title={t("noHistory")} /> : (
              <ol className="divide-y divide-border">
                {asset.assignments.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <Avatar id={a.employee.id} firstName={a.employee.firstName} lastName={a.employee.lastName} size={28} />
                    <div className="min-w-0 flex-1">
                      <Link href={`/people/${a.employee.id}`} className="text-[13px] font-medium hover:underline">{a.employee.firstName} {a.employee.lastName}</Link>
                      <div className="text-xs text-fg-subtle tabular">
                        {fmtDate(a.assignedAt, locale)} → {a.returnedAt ? fmtDate(a.returnedAt, locale) : tc("today")}
                        {a.conditionIn && ` · ${t(`condition.${a.conditionIn}`)}`}
                        {a.notesIn === "LOST" && ` · ${t("status.LOST")}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {a.handoverDocId && <a href={`/api/files/${a.handoverDocId}?inline=1`} target="_blank" rel="noreferrer"><Badge tone="success"><FileCheck2 className="size-3" />{t("handoverDoc")}</Badge></a>}
                      {a.returnDocId && <a href={`/api/files/${a.returnDocId}?inline=1`} target="_blank" rel="noreferrer"><Badge tone="info"><FileCheck2 className="size-3" />{t("returnDoc")}</Badge></a>}
                      {!a.signedAt && !a.returnedAt && <Badge tone="warning">{t("pendingSignature")}</Badge>}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <DocumentsPanel docs={docs} assetId={asset.id} canWrite={ctx.can("document.write") || canWrite} />
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title={t("sections.warranty")} />
            <CardBody className="space-y-4">
              <div className="flex items-center gap-3">
                <span className={`flex size-10 items-center justify-center rounded-xl ${left == null ? "bg-bg-subtle text-fg-subtle" : left < 0 ? "bg-danger-soft text-danger" : left <= 60 ? "bg-warning-soft text-warning" : "bg-success-soft text-success"}`}><ShieldCheck className="size-5" /></span>
                <div>
                  <div className="text-[13px] font-medium">{asset.warrantyEndDate ? fmtDate(asset.warrantyEndDate, locale) : t("noWarranty")}</div>
                  <div className="text-xs text-fg-subtle">{asset.warrantyProvider ?? ""}</div>
                </div>
              </div>
              {left != null && asset.purchaseDate && asset.warrantyEndDate && (
                <div className="h-1.5 overflow-hidden rounded-full bg-bg-subtle">
                  <div className={`h-full rounded-full ${left < 0 ? "bg-danger" : left <= 60 ? "bg-warning" : "bg-success"}`} style={{ width: `${Math.min(100, Math.max(0, ((Date.now() - asset.purchaseDate.getTime()) / (asset.warrantyEndDate.getTime() - asset.purchaseDate.getTime())) * 100))}%` }} />
                </div>
              )}
              <ul className="space-y-2 text-[13px]">
                {asset.warrantyContact && <li className="flex items-center gap-2 text-fg-muted"><Calendar className="size-3.5 text-fg-subtle" />{asset.warrantyContact}</li>}
                {asset.warrantyPhone && <li><a href={`tel:${asset.warrantyPhone}`} className="flex items-center gap-2 text-fg-muted hover:text-fg"><Phone className="size-3.5 text-fg-subtle" />{asset.warrantyPhone}</a></li>}
                {asset.warrantyEmail && <li><a href={`mailto:${asset.warrantyEmail}?subject=${encodeURIComponent(`${name} — S/N ${asset.serialNumber}`)}`} className="flex items-center gap-2 text-fg-muted hover:text-fg"><Mail className="size-3.5 text-fg-subtle" />{asset.warrantyEmail}</a></li>}
                {asset.warrantyUrl && <li><a href={asset.warrantyUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-accent hover:underline"><Globe className="size-3.5" />{t("contactWarranty")}<ExternalLink className="size-3" /></a></li>}
              </ul>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={t("label")} action={<a href={`/api/assets/${asset.id}/label`} target="_blank" rel="noreferrer" className="text-xs text-accent hover:underline">{t("printLabel")}</a>} />
            <CardBody className="flex items-center gap-4">
              <div className="size-24 shrink-0 rounded-lg bg-white p-2 [&_svg]:size-full" dangerouslySetInnerHTML={{ __html: qr }} />
              <div className="min-w-0">
                <div className="font-mono text-[15px] font-semibold">{asset.assetTag}</div>
                <div className="truncate text-xs text-fg-subtle">{name}</div>
                <div className="truncate font-mono text-xs text-fg-subtle">S/N {asset.serialNumber}</div>
              </div>
            </CardBody>
          </Card>
          {asset.notes && (
            <Card>
              <CardHeader title={t("fields.notes")} />
              <CardBody className="whitespace-pre-wrap text-[13px] text-fg-muted">{asset.notes}</CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
