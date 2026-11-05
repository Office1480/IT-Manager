"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { loginAction } from "@/server/auth-actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export function LoginForm({ next }: { next?: string }) {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label={t("email")}>
        <Input name="email" type="email" autoComplete="email" required autoFocus className="h-9" />
      </Field>
      <Field label={t("password")}>
        <Input name="password" type="password" autoComplete="current-password" required className="h-9" />
      </Field>
      {state?.error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">{t("invalid")}</p>}
      <Button type="submit" variant="primary" size="lg" disabled={pending} className="mt-1 w-full">
        {pending && <Loader2 className="animate-spin" />}
        {t("submit")}
      </Button>
    </form>
  );
}
