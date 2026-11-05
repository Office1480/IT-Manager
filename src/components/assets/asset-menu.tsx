"use client";
import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { MoreHorizontal, Pencil, Printer, Trash2, Wrench, Archive, AlertTriangle, PackageCheck } from "lucide-react";
import { toast } from "sonner";
import type { AssetStatus } from "@prisma/client";
import { Link, useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown";
import { deleteAssetAction, setAssetStatusAction } from "@/server/asset-actions";

export function AssetMenu({ id, status }: { id: string; status: AssetStatus }) {
  const t = useTranslations();
  const router = useRouter();
  const [, start] = useTransition();
  const setStatus = (s: "IN_STOCK" | "IN_REPAIR" | "LOST" | "RETIRED") =>
    start(async () => {
      const res = await setAssetStatusAction(id, s);
      if (res.ok) router.refresh();
      else toast.error(t("common.error"));
    });
  const assigned = status === "ASSIGNED";
  return (
    <div className="flex items-center gap-2">
      <Button asChild><Link href={`/assets/${id}/edit`}><Pencil />{t("common.edit")}</Link></Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button size="icon" aria-label={t("common.actions")}><MoreHorizontal /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild><a href={`/api/assets/${id}/label`} target="_blank" rel="noreferrer"><Printer />{t("assets.printLabel")}</a></DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>{t("assets.markStatus")}</DropdownMenuLabel>
          {!assigned && status !== "IN_STOCK" && <DropdownMenuItem onSelect={() => setStatus("IN_STOCK")}><PackageCheck />{t("assets.status.IN_STOCK")}</DropdownMenuItem>}
          {!assigned && status !== "IN_REPAIR" && <DropdownMenuItem onSelect={() => setStatus("IN_REPAIR")}><Wrench />{t("assets.status.IN_REPAIR")}</DropdownMenuItem>}
          {status !== "LOST" && <DropdownMenuItem onSelect={() => setStatus("LOST")}><AlertTriangle />{t("assets.status.LOST")}</DropdownMenuItem>}
          {!assigned && status !== "RETIRED" && <DropdownMenuItem onSelect={() => setStatus("RETIRED")}><Archive />{t("assets.status.RETIRED")}</DropdownMenuItem>}
          {!assigned && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-danger [&_svg]:!text-danger"
                onSelect={() => {
                  if (!confirm(t("common.confirmDelete"))) return;
                  start(async () => {
                    const res = await deleteAssetAction(id);
                    if (res.ok) { router.push("/assets"); router.refresh(); }
                  });
                }}
              ><Trash2 />{t("common.delete")}</DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
