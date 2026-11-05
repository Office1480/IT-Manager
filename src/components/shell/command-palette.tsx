"use client";
import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { useTranslations } from "next-intl";
import * as Dialog from "@radix-ui/react-dialog";
import { Search } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { Avatar } from "@/components/ui/avatar";
import { NAV, NAV_FOOTER } from "./nav-config";

const EVENT = "itm:open-command";
export const openCommandPalette = () => window.dispatchEvent(new Event(EVENT));

export type PaletteEntity = { id: string; type: "employee" | "asset" | "project"; title: string; subtitle?: string | null; href: string; firstName?: string; lastName?: string };

export function CommandPalette({ entities }: { entities: PaletteEntity[] }) {
  const t = useTranslations("nav");
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(EVENT, onOpen);
    };
  }, []);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const items = "flex h-9 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-[13px] text-fg aria-selected:bg-surface-hover [&_svg]:size-4 [&_svg]:text-fg-subtle";
  const heading = "[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-fg-subtle";

  const groups: Record<PaletteEntity["type"], string> = { employee: t("people"), asset: t("assets"), project: t("projects") };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-[14vh] z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-surface shadow-lg animate-in">
          <Dialog.Title className="sr-only">{t("searchPlaceholder")}</Dialog.Title>
          <Command loop>
            <div className="flex items-center gap-2.5 border-b border-border px-4">
              <Search className="size-4 text-fg-subtle" />
              <Command.Input autoFocus placeholder={t("searchPlaceholder")} className="h-12 flex-1 bg-transparent text-[14px] outline-none placeholder:text-fg-subtle" />
            </div>
            <Command.List className={`max-h-[50vh] overflow-y-auto scrollbar-thin p-2 ${heading}`}>
              <Command.Empty className="py-10 text-center text-[13px] text-fg-subtle">—</Command.Empty>
              {(["employee", "project", "asset"] as const).map((type) => {
                const list = entities.filter((e) => e.type === type);
                if (!list.length) return null;
                return (
                  <Command.Group key={type} heading={groups[type]}>
                    {list.map((e) => (
                      <Command.Item key={e.id} value={`${e.title} ${e.subtitle ?? ""} ${e.id}`} onSelect={() => go(e.href)} className={items}>
                        {e.type === "employee" && e.firstName ? <Avatar id={e.id} firstName={e.firstName} lastName={e.lastName ?? ""} size={20} /> : null}
                        <span className="truncate">{e.title}</span>
                        {e.subtitle && <span className="ms-auto truncate text-xs text-fg-subtle">{e.subtitle}</span>}
                      </Command.Item>
                    ))}
                  </Command.Group>
                );
              })}
              <Command.Group heading="Navigation">
                {[...NAV.flatMap((g) => g.items), ...NAV_FOOTER].map((i) => {
                  const Icon = i.icon;
                  return (
                    <Command.Item key={i.key} value={`nav ${t(i.key)}`} onSelect={() => go(i.href)} className={items}>
                      <Icon />
                      {t(i.key)}
                    </Command.Item>
                  );
                })}
              </Command.Group>
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
