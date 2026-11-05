"use client";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { saveProjectAction } from "@/server/project-actions";
import { cn } from "@/lib/utils";

const COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6", "#ec4899", "#84cc16", "#f97316", "#64748b"];

export type ProjectFormValues = {
  id: string; key: string; name: string; tagline: string | null; definition: string | null; status: string; criticality: string; color: string;
  ownerId: string | null; ownerExpertise: number; deputyId: string | null; deputyExpertise: number; links: { label: string; url: string }[]; jiraProjectKey: string | null;
};

export function ProjectFormDialog({ initial, employees, trigger }: { initial?: ProjectFormValues; employees: { id: string; firstName: string; lastName: string }[]; trigger?: "edit" | "new" }) {
  const t = useTranslations("projects");
  const tc = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [color, setColor] = useState(initial?.color ?? COLORS[0]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const v = initial;
  const lvl = (name: string, def: number) => (
    <Select name={name} defaultValue={String(def)}>
      {[1, 2, 3, 4, 5].map((i) => <option key={i} value={i}>{i} — {t(`expertise.${i}`)}</option>)}
    </Select>
  );
  return (
    <>
      {trigger === "edit" ? <Button onClick={() => setOpen(true)}><Pencil />{tc("edit")}</Button> : <Button variant="primary" onClick={() => setOpen(true)}><Plus />{t("new")}</Button>}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={v ? t("edit") : t("new")} wide>
          <form
            className="grid grid-cols-1 gap-4 sm:grid-cols-6"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              fd.set("color", color);
              start(async () => {
                const res = await saveProjectAction(v?.id ?? null, fd);
                if (!res.ok) { setErrors(res.fieldErrors ?? {}); return void toast.error(res.fieldErrors ? Object.values(res.fieldErrors)[0] : tc("error")); }
                toast.success(v ? tc("saved") : tc("created"));
                setOpen(false);
                if (!v) router.push(`/projects/${res.data!.id}`);
                router.refresh();
              });
            }}
          >
            <Field label={t("fields.name")} required error={errors.name} className="sm:col-span-4"><Input name="name" defaultValue={v?.name} autoFocus /></Field>
            <Field label={t("fields.key")} required error={errors.key} className="sm:col-span-2"><Input name="key" defaultValue={v?.key} placeholder="ERP" className="uppercase" maxLength={10} /></Field>
            <Field label={t("fields.tagline")} className="sm:col-span-6"><Input name="tagline" defaultValue={v?.tagline ?? ""} /></Field>
            <Field label={t("fields.owner")} error={errors.ownerId} className="sm:col-span-4">
              <Select name="ownerId" defaultValue={v?.ownerId ?? ""}><option value="">—</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}</Select>
            </Field>
            <Field label={t("fields.ownerExpertise")} className="sm:col-span-2">{lvl("ownerExpertise", v?.ownerExpertise ?? 5)}</Field>
            <Field label={t("fields.deputy")} error={errors.deputyId} className="sm:col-span-4">
              <Select name="deputyId" defaultValue={v?.deputyId ?? ""}><option value="">—</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}</Select>
            </Field>
            <Field label={t("fields.deputyExpertise")} className="sm:col-span-2">{lvl("deputyExpertise", v?.deputyExpertise ?? 3)}</Field>
            <Field label={t("fields.status")} className="sm:col-span-2">
              <Select name="status" defaultValue={v?.status ?? "ACTIVE"}>{(["ACTIVE", "BUILD", "MAINTENANCE", "SUNSET"] as const).map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}</Select>
            </Field>
            <Field label={t("fields.criticality")} className="sm:col-span-2">
              <Select name="criticality" defaultValue={v?.criticality ?? "MEDIUM"}>{(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const).map((s) => <option key={s} value={s}>{t(`criticality.${s}`)}</option>)}</Select>
            </Field>
            <Field label={t("fields.jiraProjectKey")} className="sm:col-span-2"><Input name="jiraProjectKey" defaultValue={v?.jiraProjectKey ?? ""} className="uppercase" /></Field>
            <Field label={t("fields.color")} className="sm:col-span-6">
              <div className="flex flex-wrap gap-1.5">
                {COLORS.map((c) => <button type="button" key={c} onClick={() => setColor(c)} className={cn("size-6 rounded-full ring-offset-2 ring-offset-surface transition", color === c && "ring-2")} style={{ background: c, ["--tw-ring-color" as string]: c }} />)}
              </div>
            </Field>
            <Field label={t("fields.definition")} className="sm:col-span-6"><Textarea name="definition" defaultValue={v?.definition ?? ""} rows={5} /></Field>
            <Field label={t("fields.links")} className="sm:col-span-6">
              <Textarea name="links" defaultValue={v?.links.map((l) => `${l.label} | ${l.url}`).join("\n") ?? ""} rows={3} placeholder={"Repo | https://github.com/…\nDocs | https://…"} className="font-mono text-xs" />
            </Field>
            <div className="flex justify-end gap-2 sm:col-span-6">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{tc("cancel")}</Button>
              <Button type="submit" variant="primary" disabled={pending}>{pending && <Loader2 className="animate-spin" />}{tc("save")}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
