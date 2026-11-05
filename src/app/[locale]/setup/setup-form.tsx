"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { setupAction } from "@/server/setup-actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export function SetupForm() {
  const t = useTranslations("setup");
  const tc = useTranslations("common");
  const [state, action, pending] = useActionState(setupAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label={t("orgName")}><Input name="orgName" required autoFocus className="h-9" /></Field>
      <Field label={t("name")}><Input name="name" required className="h-9" /></Field>
      <Field label={t("email")}><Input name="email" type="email" required className="h-9" /></Field>
      <Field label={t("password")}><Input name="password" type="password" minLength={8} required className="h-9" /></Field>
      {state?.error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">{tc("error")}</p>}
      <Button type="submit" variant="primary" size="lg" disabled={pending} className="mt-1 w-full">{pending && <Loader2 className="animate-spin" />}{t("submit")}</Button>
    </form>
  );
}
