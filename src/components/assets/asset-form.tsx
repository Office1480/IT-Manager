"use client";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { createAssetAction, updateAssetAction } from "@/server/asset-actions";
import { toDateInput } from "@/lib/utils";

const CATEGORIES = ["LAPTOP", "DESKTOP", "MONITOR", "KEYBOARD", "MOUSE", "HEADSET", "DOCKING", "PHONE", "TABLET", "PRINTER", "NETWORK", "SERVER", "ACCESSORY", "OTHER"] as const;

export type AssetFormValues = Partial<Record<string, unknown>> & { id?: string };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader title={title} />
      <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</CardBody>
    </Card>
  );
}

export function AssetForm({ initial, suppliers, suggestedTag, currency }: { initial?: AssetFormValues; suppliers: { id: string; name: string }[]; suggestedTag?: string; currency: string }) {
  const t = useTranslations("assets");
  const tc = useTranslations("common");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [supplier, setSupplier] = useState(String(initial?.supplierId ?? ""));
  const v = initial ?? {};
  const s = (x: unknown) => (x == null ? "" : String(x));

  const f = ({ name, type = "text", required, className, ...rest }: { name: string; type?: string; required?: boolean; className?: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
    <Field key={name} label={t(`fields.${name}`)} required={required} error={errors[name]} className={className}>
      <Input name={name} type={type} defaultValue={type === "date" ? toDateInput(v[name] as Date | null) : s(v[name])} aria-invalid={!!errors[name]} {...rest} />
    </Field>
  );

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = v.id ? await updateAssetAction(v.id, fd) : await createAssetAction(fd);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        return void toast.error(res.fieldErrors ? Object.values(res.fieldErrors)[0] : tc("error"));
      }
      toast.success(v.id ? tc("saved") : tc("created"));
      router.push(`/assets/${res.data!.id}`);
      router.refresh();
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5 pb-20" noValidate>
      <Section title={t("sections.identity")}>
        <Field label={t("fields.category")} required>
          <Select name="category" defaultValue={s(v.category) || "LAPTOP"}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{t(`category.${c}`)}</option>)}
          </Select>
        </Field>
        {f({ name: "brand", required: true, autoFocus: true, placeholder: "Dell, Apple, Lenovo…" })}
        {f({ name: "model", required: true, placeholder: "Latitude 7450" })}
        {f({ name: "serialNumber", required: true, className: "font-mono" })}
        <Field label={t("fields.assetTag")} error={errors.assetTag}>
          <Input name="assetTag" defaultValue={s(v.assetTag) || suggestedTag} />
        </Field>
        <Field label={t("fields.condition")}>
          <Select name="condition" defaultValue={s(v.condition) || "NEW"}>
            {(["NEW", "GOOD", "FAIR", "DAMAGED"] as const).map((c) => <option key={c} value={c}>{t(`condition.${c}`)}</option>)}
          </Select>
        </Field>
        {f({ name: "specs", className: "sm:col-span-2 lg:col-span-3", placeholder: "Intel Core Ultra 7 · 32 Go · 1 To SSD" })}
      </Section>

      <Section title={t("sections.purchase")}>
        {f({ name: "purchaseDate", type: "date" })}
        {f({ name: "purchasePrice", type: "number", step: "0.01", min: 0 })}
        <Field label={t("fields.currency")}>
          <Select name="currency" defaultValue={s(v.currency) || currency}>
            {["ILS", "USD", "EUR"].map((c) => <option key={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label={t("fields.supplier")}>
          <Select name="supplierId" value={supplier} onChange={(e) => setSupplier(e.target.value)}>
            <option value="">—</option>
            {suppliers.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            <option value="__new">+ {t("fields.newSupplier")}</option>
          </Select>
          {supplier === "__new" && <Input name="newSupplier" autoFocus className="mt-1.5" placeholder={t("fields.newSupplier")} />}
        </Field>
        {f({ name: "invoiceNumber" })}
        {f({ name: "replacementCost", type: "number", step: "0.01", min: 0 })}
      </Section>

      <Section title={t("sections.warranty")}>
        {f({ name: "warrantyEndDate", type: "date" })}
        {f({ name: "warrantyProvider" })}
        {f({ name: "warrantyContact" })}
        {f({ name: "warrantyPhone", type: "tel" })}
        {f({ name: "warrantyEmail", type: "email" })}
        {f({ name: "warrantyUrl", type: "url", placeholder: "https://" })}
      </Section>

      <Card>
        <CardHeader title={t("sections.other")} />
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {f({ name: "location" })}
          <Field label={t("fields.notes")} className="sm:col-span-2">
            <Textarea name="notes" defaultValue={s(v.notes)} rows={2} />
          </Field>
        </CardBody>
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/85 backdrop-blur lg:start-60">
        <div className="mx-auto flex max-w-[1400px] items-center justify-end gap-2 px-4 py-3 sm:px-6 lg:px-10">
          <Button type="button" variant="ghost" onClick={() => router.back()}>{tc("cancel")}</Button>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            {pending ? tc("saving") : tc("save")}
          </Button>
        </div>
      </div>
    </form>
  );
}
