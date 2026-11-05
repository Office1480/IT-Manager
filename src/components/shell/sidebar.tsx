"use client";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { Link, usePathname } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import type { Permission } from "@/lib/rbac";
import { Kbd } from "@/components/ui/misc";
import { NAV, NAV_FOOTER, type NavItem } from "./nav-config";
import { UserMenu } from "./user-menu";
import { openCommandPalette } from "./command-palette";

export function Sidebar({
  orgName,
  permissions,
  user,
}: {
  orgName: string;
  permissions: Permission[];
  user: { name: string; email: string; role: string; employeeId: string | null };
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const allowed = (i: NavItem) => !i.permission || permissions.includes(i.permission);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));
  // L'élément le plus spécifique gagne (ex. /projects/map vs /projects)
  const allHrefs = [...NAV.flatMap((g) => g.items), ...NAV_FOOTER].map((i) => i.href);
  const activeHref = allHrefs.filter(isActive).sort((a, b) => b.length - a.length)[0];

  const item = (i: NavItem) => {
    const Icon = i.icon;
    const active = activeHref === i.href;
    return (
      <Link
        key={i.key}
        href={i.href}
        prefetch
        className={cn(
          "group flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors",
          active ? "bg-surface text-fg shadow-sm ring-1 ring-border" : "text-fg-muted hover:bg-surface-hover hover:text-fg",
        )}
      >
        <Icon className={cn("size-4 shrink-0", active ? "text-accent" : "text-fg-subtle group-hover:text-fg-muted")} />
        <span className="truncate">{t(i.key)}</span>
      </Link>
    );
  };

  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-e border-border bg-bg-subtle lg:flex">
      <div className="flex h-14 items-center gap-2.5 px-4">
        <div className="flex size-7 items-center justify-center rounded-lg bg-accent text-[11px] font-bold text-white shadow-sm">IT</div>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold leading-tight">{orgName}</div>
          <div className="text-[11px] leading-tight text-fg-subtle">IT Manager</div>
        </div>
      </div>
      <div className="px-3 pb-2">
        <button
          onClick={openCommandPalette}
          className="flex h-8 w-full items-center gap-2 rounded-lg border border-border bg-surface px-2.5 text-[13px] text-fg-subtle shadow-sm transition-colors hover:border-border-strong"
        >
          <Search className="size-3.5" />
          <span className="flex-1 truncate text-start">{t("searchPlaceholder")}</span>
          <Kbd>⌘K</Kbd>
        </button>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto scrollbar-thin px-3 py-3">
        {NAV.map((g) => {
          const items = g.items.filter(allowed);
          if (!items.length) return null;
          return (
            <div key={g.key}>
              <div className="mb-1 px-2.5 text-[11px] font-medium uppercase tracking-wider text-fg-subtle">{t(g.key)}</div>
              <div className="space-y-0.5">{items.map(item)}</div>
            </div>
          );
        })}
      </nav>
      <div className="space-y-0.5 border-t border-border px-3 py-2">{NAV_FOOTER.filter(allowed).map(item)}</div>
      <div className="border-t border-border p-2">
        <UserMenu user={user} />
      </div>
    </aside>
  );
}
