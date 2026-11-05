"use client";
import { useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Download, Eye, FileImage, FileText, Loader2, Lock, Plus, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import type { DocumentCategory } from "@prisma/client";
import { useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { deleteDocumentAction, uploadDocumentAction } from "@/server/document-actions";
import { fmtDate } from "@/lib/format";
import { cn, daysUntil, formatBytes } from "@/lib/utils";

export type DocRow = {
  id: string;
  title: string;
  fileName: string;
  mimeType: string;
  size: number;
  category: DocumentCategory;
  expiresAt: Date | null;
  uploadedByName: string | null;
  createdAt: Date;
};

const EMPLOYEE_CATS: DocumentCategory[] = ["ID_CARD", "PASSPORT", "CONTRACT", "CONTRACT_ANNEX", "FORM_101", "PAYSLIP", "DIPLOMA", "CERTIFICATE", "MEDICAL", "BANK", "HANDOVER_FORM", "RETURN_FORM", "OTHER"];
const ASSET_CATS: DocumentCategory[] = ["PURCHASE_PROOF", "WARRANTY", "HANDOVER_FORM", "RETURN_FORM", "OTHER"];

export function DocumentsPanel({ docs, employeeId, assetId, canWrite }: { docs: DocRow[]; employeeId?: string; assetId?: string; canWrite: boolean }) {
  const t = useTranslations("documents");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const cats = assetId ? ASSET_CATS : EMPLOYEE_CATS;

  const grouped = cats
    .map((c) => ({ cat: c, items: docs.filter((d) => d.category === c) }))
    .filter((g) => g.items.length);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!file) return;
    const fd = new FormData(e.currentTarget);
    fd.set("file", file);
    if (employeeId) fd.set("employeeId", employeeId);
    if (assetId) fd.set("assetId", assetId);
    start(async () => {
      const res = await uploadDocumentAction(fd);
      if (!res.ok) return void toast.error(res.error === "tooLarge" ? t("tooLarge") : res.error === "badType" ? t("badType") : tc("error"));
      toast.success(tc("created"));
      setOpen(false);
      setFile(null);
      router.refresh();
    });
  };

  const remove = (id: string) => {
    if (!confirm(tc("confirmDelete"))) return;
    start(async () => {
      const res = await deleteDocumentAction(id);
      if (res.ok) {
        toast.success(tc("deleted"));
        router.refresh();
      } else toast.error(tc("error"));
    });
  };

  return (
    <Card>
      <CardHeader
        title={t("title")}
        description={
          <span className="inline-flex items-center gap-1">
            <Lock className="size-3" />
            {t("encrypted")}
          </span>
        }
        action={
          canWrite && (
            <Button size="sm" variant="primary" onClick={() => setOpen(true)}>
              <Plus />
              {t("upload")}
            </Button>
          )
        }
      />
      {docs.length === 0 ? (
        <EmptyState icon={<FileText />} title={t("empty")} description={canWrite ? t("emptyHint") : undefined} />
      ) : (
        <div className="divide-y divide-border">
          {grouped.map((g) => (
            <div key={g.cat} className="px-5 py-3">
              <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-fg-subtle">{t(`categories.${g.cat}`)}</div>
              <ul className="space-y-1">
                {g.items.map((d) => {
                  const left = daysUntil(d.expiresAt);
                  const Icon = d.mimeType.startsWith("image/") ? FileImage : FileText;
                  return (
                    <li key={d.id} className="group -mx-2 flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-hover">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-bg-subtle text-fg-subtle">
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-medium">{d.title}</div>
                        <div className="truncate text-xs text-fg-subtle">
                          {d.fileName} · {formatBytes(d.size)} · {fmtDate(d.createdAt, locale)}
                          {d.uploadedByName ? ` · ${t("uploadedBy", { name: d.uploadedByName })}` : ""}
                        </div>
                      </div>
                      {left != null &&
                        (left < 0 ? (
                          <Badge tone="danger">{t("expired")}</Badge>
                        ) : left <= 60 ? (
                          <Badge tone="warning">{t("expiresIn", { count: left })}</Badge>
                        ) : (
                          <span className="hidden text-xs text-fg-subtle sm:inline">{fmtDate(d.expiresAt, locale)}</span>
                        ))}
                      <div className="flex items-center gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
                        {(d.mimeType === "application/pdf" || d.mimeType.startsWith("image/")) && (
                          <Button asChild size="icon" variant="ghost" title="Preview">
                            <a href={`/api/files/${d.id}?inline=1`} target="_blank" rel="noreferrer">
                              <Eye />
                            </a>
                          </Button>
                        )}
                        <Button asChild size="icon" variant="ghost" title={tc("download")}>
                          <a href={`/api/files/${d.id}`}>
                            <Download />
                          </a>
                        </Button>
                        {canWrite && (
                          <Button size="icon" variant="ghost" onClick={() => remove(d.id)} disabled={pending} title={tc("delete")}>
                            <Trash2 />
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={t("upload")}>
          <form onSubmit={submit} className="space-y-4">
            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                const f = e.dataTransfer.files?.[0];
                if (f) setFile(f);
              }}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border px-4 py-8 text-center transition-colors hover:border-accent hover:bg-accent-soft/40",
                drag && "border-accent bg-accent-soft/60",
              )}
            >
              <UploadCloud className="mb-2 size-6 text-fg-subtle" />
              {file ? (
                <>
                  <div className="text-[13px] font-medium">{file.name}</div>
                  <div className="text-xs text-fg-subtle">{formatBytes(file.size)}</div>
                </>
              ) : (
                <div className="text-[13px] text-fg-muted">{t("dropHint")}</div>
              )}
              <input ref={inputRef} type="file" hidden accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,.doc,.docx,.xls,.xlsx,.txt" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t("category")}>
                <Select name="category" defaultValue={cats[0]}>
                  {cats.map((c) => (
                    <option key={c} value={c}>
                      {t(`categories.${c}`)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("expiresAt")}>
                <Input type="date" name="expiresAt" />
              </Field>
              <Field label={t("docTitle")} className="sm:col-span-2">
                <Input name="title" placeholder={file?.name.replace(/\.[^.]+$/, "")} />
              </Field>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {tc("cancel")}
              </Button>
              <Button type="submit" variant="primary" disabled={!file || pending}>
                {pending && <Loader2 className="animate-spin" />}
                {tc("upload")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
