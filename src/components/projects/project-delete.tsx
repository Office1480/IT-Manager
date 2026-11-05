"use client";
import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { deleteProjectAction } from "@/server/project-actions";

export function ProjectDeleteButton({ id }: { id: string }) {
  const t = useTranslations("projects");
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button size="icon" variant="ghost" className="text-danger" disabled={pending} onClick={() => {
      if (!confirm(t("deleteConfirm"))) return;
      start(async () => { const r = await deleteProjectAction(id); if (r.ok) { router.push("/projects"); router.refresh(); } });
    }}><Trash2 /></Button>
  );
}
