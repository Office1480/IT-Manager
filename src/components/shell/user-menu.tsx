"use client";
import { useEffect, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, ChevronsUpDown, Languages, LogOut, Moon, Sun, UserRound } from "lucide-react";
import { Link, usePathname, useRouter } from "@/i18n/routing";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown";
import { logoutAction } from "@/server/auth-actions";
import { colorFor, initials } from "@/lib/utils";

const LANGS = [
  { code: "fr", label: "Français" },
  { code: "en", label: "English" },
  { code: "he", label: "עברית" },
] as const;

export function useTheme() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  const toggle = () => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("itm-theme", next ? "dark" : "light");
    } catch {}
    setDark(next);
  };
  return { dark, toggle };
}

export function UserMenu({ user }: { user: { name: string; email: string; role: string; employeeId: string | null } }) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { dark, toggle } = useTheme();
  const [, startTransition] = useTransition();
  const [first, ...rest] = user.name.split(" ");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-lg p-1.5 text-start outline-none transition-colors hover:bg-surface-hover data-[state=open]:bg-surface-hover">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white" style={{ background: colorFor(user.email) }}>
          {initials(first, rest.join(" "))}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium leading-tight">{user.name}</span>
          <span className="block truncate text-[11px] leading-tight text-fg-subtle">{t(`roles.${user.role}`)}</span>
        </span>
        <ChevronsUpDown className="size-3.5 text-fg-subtle" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-56">
        <DropdownMenuLabel className="normal-case tracking-normal">{user.email}</DropdownMenuLabel>
        {user.employeeId && (
          <DropdownMenuItem asChild>
            <Link href={`/people/${user.employeeId}`}>
              <UserRound />
              {t("nav.myProfile")}
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); toggle(); }}>
          {dark ? <Sun /> : <Moon />}
          {dark ? t("nav.light") : t("nav.dark")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex items-center gap-1.5">
          <Languages className="size-3" />
          {t("nav.language")}
        </DropdownMenuLabel>
        {LANGS.map((l) => (
          <DropdownMenuItem key={l.code} onSelect={() => startTransition(() => router.replace(pathname, { locale: l.code }))}>
            <span className="flex-1">{l.label}</span>
            {locale === l.code && <Check className="!text-accent" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => logoutAction()} className="text-danger [&_svg]:!text-danger">
          <LogOut />
          {t("nav.logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
