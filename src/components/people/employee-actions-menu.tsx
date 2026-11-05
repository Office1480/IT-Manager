"use client";
import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Archive, MoreHorizontal, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Link, useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown";
import { archiveEmployeeAction } from "@/server/employee-actions";

export function EmployeeActionsMenu({ id }: { id: string }) {
  const t = useTranslations();
  const router = useRouter();
  const [, start] = useTransition();
  return (
    <div className="flex items-center gap-2">
      <Button asChild>
        <Link href={`/people/${id}/edit`}>
          <Pencil />
          {t("common.edit")}
        </Link>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" aria-label={t("common.actions")}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            className="text-danger [&_svg]:!text-danger"
            onSelect={() => {
              if (!confirm(t("people.deleteConfirm"))) return;
              start(async () => {
                const res = await archiveEmployeeAction(id);
                if (res.ok) {
                  toast.success(t("people.archived"));
                  router.push("/people");
                  router.refresh();
                }
              });
            }}
          >
            <Archive />
            {t("common.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
