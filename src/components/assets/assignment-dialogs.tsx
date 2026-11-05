"use client";
import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2, PenLine, Send, UserPlus, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { assignAssetAction, returnAssetAction, signAssignmentAction } from "@/server/asset-actions";
import { fmtMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SignaturePad } from "./signature-pad";

const CONDITIONS = ["NEW", "GOOD", "FAIR", "DAMAGED"] as const;

function Terms({ amount }: { amount: string }) {
  const t = useTranslations("assets");
  return <p className="rounded-xl bg-bg-subtle p-3 text-xs leading-relaxed text-fg-muted">{t("terms", { amount })}</p>;
}

function Accept() {
  const t = useTranslations("assets");
  return (
    <label className="flex cursor-pointer items-start gap-2 text-[13px]">
      <input type="checkbox" name="accept" required className="mt-0.5 size-4 accent-[var(--accent)]" />
      {t("acceptTerms")}
    </label>
  );
}

export function AssignDialog({
  assetId,
  assetName,
  employees,
  defaultLiability,
  currency,
}: {
  assetId: string;
  assetName: string;
  employees: { id: string; firstName: string; lastName: string }[];
  defaultLiability: number | null;
  currency: string;
}) {
  const t = useTranslations("assets");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"now" | "later">("now");
  const [employee, setEmployee] = useState("");
  const [liability, setLiability] = useState(defaultLiability != null ? String(defaultLiability) : "");
  const [pending, start] = useTransition();
  const emp = employees.find((e) => e.id === employee);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("mode", mode);
    start(async () => {
      const res = await assignAssetAction(assetId, fd);
      if (!res.ok) return void toast.error(res.error === "signature" ? t("signHere") : tc("error"));
      toast.success(t("assigned"));
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}><UserPlus />{t("assign")}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={t("assignTitle", { name: assetName })} wide>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t("assignTo")} required>
                <Select name="employeeId" value={employee} onChange={(e) => setEmployee(e.target.value)} required>
                  <option value="">—</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
                </Select>
              </Field>
              <Field label={`${t("liability")} (${currency})`} hint={t("liabilityHint")}>
                <Input name="liabilityAmount" type="number" min={0} step="0.01" value={liability} onChange={(e) => setLiability(e.target.value)} />
              </Field>
              <Field label={t("conditionOut")}>
                <Select name="conditionOut" defaultValue="GOOD">
                  {CONDITIONS.map((c) => <option key={c} value={c}>{t(`condition.${c}`)}</option>)}
                </Select>
              </Field>
              <Field label={t("expectedReturn")}>
                <Input name="expectedReturn" type="date" />
              </Field>
              <Field label={t("notesOut")} className="sm:col-span-2">
                <Textarea name="notesOut" rows={2} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-xl bg-bg-subtle p-1">
              {(["now", "later"] as const).map((m) => (
                <button key={m} type="button" onClick={() => setMode(m)} className={cn("flex items-center justify-center gap-2 rounded-lg py-2 text-[13px] font-medium text-fg-muted transition-colors", mode === m && "bg-surface text-fg shadow-sm")}>
                  {m === "now" ? <PenLine className="size-4" /> : <Send className="size-4" />}
                  {t(m === "now" ? "signNow" : "signLater")}
                </button>
              ))}
            </div>

            {mode === "now" ? (
              <div className="space-y-3">
                <Terms amount={liability ? fmtMoney(Number(liability), locale, currency) : "—"} />
                <Field label={t("signerName")}>
                  <Input name="signerName" key={employee} defaultValue={emp ? `${emp.firstName} ${emp.lastName}` : ""} />
                </Field>
                <SignaturePad />
                <Accept />
              </div>
            ) : (
              <p className="text-[13px] text-fg-muted">{t("signLaterHint")}</p>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{tc("cancel")}</Button>
              <Button type="submit" variant="primary" disabled={pending || !employee}>
                {pending && <Loader2 className="animate-spin" />}
                {t("assign")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function SignDialog({ assignmentId, assetName, amount, signerName, trigger }: { assignmentId: string; assetName: string; amount: string; signerName: string; trigger?: React.ReactNode }) {
  const t = useTranslations("assets");
  const tc = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await signAssignmentAction(assignmentId, fd);
      if (!res.ok) return void toast.error(res.error === "signature" ? t("signHere") : tc("error"));
      toast.success(t("signedOk"));
      setOpen(false);
      router.refresh();
    });
  };
  return (
    <>
      <span onClick={() => setOpen(true)}>{trigger ?? <Button size="sm" variant="primary"><PenLine />{t("sign")}</Button>}</span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={`${t("sign")} — ${assetName}`} wide>
          <form onSubmit={submit} className="space-y-3">
            <Terms amount={amount} />
            <Field label={t("signerName")}><Input name="signerName" defaultValue={signerName} /></Field>
            <SignaturePad />
            <Accept />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{tc("cancel")}</Button>
              <Button type="submit" variant="primary" disabled={pending}>{pending && <Loader2 className="animate-spin" />}{t("sign")}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ReturnDialog({ assignmentId, assetName, holderName }: { assignmentId: string; assetName: string; holderName: string }) {
  const t = useTranslations("assets");
  const tc = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await returnAssetAction(assignmentId, fd);
      if (!res.ok) return void toast.error(tc("error"));
      toast.success(t("returned"));
      setOpen(false);
      router.refresh();
    });
  };
  return (
    <>
      <Button onClick={() => setOpen(true)}><Undo2 />{t("return")}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={t("returnTitle", { name: assetName })} wide>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t("conditionIn")}>
                <Select name="conditionIn" defaultValue="GOOD">
                  {CONDITIONS.map((c) => <option key={c} value={c}>{t(`condition.${c}`)}</option>)}
                </Select>
              </Field>
              <Field label={t("signerName")}><Input name="signerName" defaultValue={holderName} /></Field>
              <Field label={t("notesOut")} className="sm:col-span-2"><Textarea name="notesIn" rows={2} /></Field>
            </div>
            <p className="text-xs text-fg-muted">{t("returnTerms")}</p>
            <SignaturePad />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{tc("cancel")}</Button>
              <Button type="submit" variant="primary" disabled={pending}>{pending && <Loader2 className="animate-spin" />}{t("return")}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
