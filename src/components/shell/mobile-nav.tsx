"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import * as Dialog from "@radix-ui/react-dialog";
import { Menu, Search } from "lucide-react";
import { Link, usePathname } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import type { Permission } from "@/lib/rbac";
import { NAV, NAV_FOOTER } from "./nav-config";
import { openCommandPalette } from "./command-palette";
import { UserMenu } from "./user-menu";

export function MobileNav({ orgName, permissions, user }: { orgName: string; permissions: Permission[]; user: { name: string; email: string; role: string; employeeId: string | null } }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = [...NAV.flatMap((g) => g.items), ...NAV_FOOTER].filter((i) => !i.permission || permissions.includes(i.permission));
  return (
    <header className="sticky top-0 z-40 flex h-12 items-center gap-2 border-b border-border bg-bg/80 px-3 backdrop-blur lg:hidden">
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger className="rounded-md p-1.5 text-fg-muted hover:bg-surface-hover">
          <Menu className="size-5" />
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <Dialog.Content className="fixed inset-y-0 start-0 z-50 flex w-72 flex-col bg-bg-subtle shadow-lg animate-in">
            <Dialog.Title className="flex h-12 items-center px-4 text-[13px] font-semibold">{orgName}</Dialog.Title>
            <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
              {items.map((i) => {
                const Icon = i.icon;
                const active = i.href === "/" ? pathname === "/" : pathname.startsWith(i.href);
                return (
                  <Link key={i.key} href={i.href} onClick={() => setOpen(false)} className={cn("flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium", active ? "bg-surface text-fg shadow-sm" : "text-fg-muted")}>
                    <Icon className="size-4" />
                    {t(i.key)}
                  </Link>
                );
              })}
            </nav>
            <div className="border-t border-border p-2">
              <UserMenu user={user} />
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <span className="flex-1 truncate text-[13px] font-semibold">{orgName}</span>
      <button onClick={openCommandPalette} className="rounded-md p-1.5 text-fg-muted hover:bg-surface-hover">
        <Search className="size-4" />
      </button>
    </header>
  );
}
