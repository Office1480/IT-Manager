"use client";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { adjustBalanceAction } from "@/server/leave-actions";

export function AdjustDialog({ employeeId, types }: { employeeId: string; types: { id: string; name: string }[] }) {
  const t = useTranslations("leave");
  const tc = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}><SlidersHorizontal />{t("adjust")}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={t("adjust")}>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              fd.set("employeeId", employeeId);
              start(async () => {
                const res = await adjustBalanceAction(fd);
                if (!res.ok) return void toast.error(tc("error"));
                toast.success(t("adjusted"));
                setOpen(false);
                router.refresh();
              });
            }}
          >
            <Field label={t("type")}><Select name="leaveTypeId">{types.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></Field>
            <Field label={t("adjustDays")}><Input name="days" type="number" step="0.5" required /></Field>
            <Field label={t("reason")}><Input name="reason" required /></Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{tc("cancel")}</Button>
              <Button type="submit" variant="primary" disabled={pending}>{pending && <Loader2 className="animate-spin" />}{tc("save")}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
