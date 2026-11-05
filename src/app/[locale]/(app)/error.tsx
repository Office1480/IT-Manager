"use client";
import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { EmptyState } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("common");
  const forbidden = error.message?.startsWith("Permission");
  return (
    <EmptyState
      icon={<AlertTriangle />}
      title={forbidden ? t("forbidden") : t("error")}
      description={error.digest}
      action={<Button onClick={reset}>{t("back")}</Button>}
    />
  );
}
