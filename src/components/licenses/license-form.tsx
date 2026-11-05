"use client";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { saveLicenseAction } from "@/server/phase5-actions";
import { toDateInput } from "@/lib/utils";

export type LicenseValues = { id: string; name: string; vendor: string | null; category: string | null; costPerSeat: number | null; currency: string; billingCycle: string; seatsPurchased: number | null; renewalDate: Date | null; url: string | null; notes: string | null };

export function LicenseFormDialog({ initial }: { initial?: LicenseValues }) {
  const t = useTranslations("licenses");
  const tc = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const v = initial;
  return (
    <>
      {v ? <Button onClick={() => setOpen(true)}><Pencil />{tc("edit")}</Button> : <Button variant="primary" onClick={() => setOpen(true)}><Plus />{t("new")}</Button>}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={v ? t("edit") : t("new")}>
          <form
            className="grid grid-cols-1 gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              start(async () => {
                const r = await saveLicenseAction(v?.id ?? null, fd);
                if (!r.ok) return void toast.error(tc("error"));
                toast.success(tc("saved"));
                setOpen(false);
                if (!v) router.push(`/licenses/${r.data!.id}`);
                router.refresh();
              });
            }}
          >
            <Field label={t("fields.name")} required><Input name="name" defaultValue={v?.name} required autoFocus /></Field>
            <Field label={t("fields.vendor")}><Input name="vendor" defaultValue={v?.vendor ?? ""} /></Field>
            <Field label={t("fields.category")}><Input name="category" defaultValue={v?.category ?? ""} placeholder="Collaboration, Dev, Sécurité…" /></Field>
            <Field label={t("fields.seatsPurchased")}><Input name="seatsPurchased" type="number" min={0} defaultValue={v?.seatsPurchased ?? ""} /></Field>
            <Field label={t("fields.costPerSeat")}><Input name="costPerSeat" type="number" step="0.01" min={0} defaultValue={v?.costPerSeat ?? ""} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label={t("fields.currency")}><Select name="currency" defaultValue={v?.currency ?? "USD"}>{["USD", "ILS", "EUR"].map((c) => <option key={c}>{c}</option>)}</Select></Field>
              <Field label={t("fields.billingCycle")}><Select name="billingCycle" defaultValue={v?.billingCycle ?? "MONTHLY"}>{(["MONTHLY", "YEARLY"] as const).map((c) => <option key={c} value={c}>{t(`cycle.${c}`)}</option>)}</Select></Field>
            </div>
            <Field label={t("fields.renewalDate")}><Input name="renewalDate" type="date" defaultValue={toDateInput(v?.renewalDate)} /></Field>
            <Field label={t("fields.url")}><Input name="url" type="url" defaultValue={v?.url ?? ""} placeholder="https://" /></Field>
            <Field label={t("fields.notes")} className="sm:col-span-2"><Textarea name="notes" defaultValue={v?.notes ?? ""} rows={2} /></Field>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{tc("cancel")}</Button>
              <Button type="submit" variant="primary" disabled={pending}>{pending && <Loader2 className="animate-spin" />}{tc("save")}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
