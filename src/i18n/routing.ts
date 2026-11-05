import { defineRouting } from "next-intl/routing";
import { createNavigation } from "next-intl/navigation";

export const routing = defineRouting({
  locales: ["fr", "en", "he"],
  defaultLocale: "fr",
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];
export const rtlLocales: Locale[] = ["he"];
export const isRtl = (l: string) => rtlLocales.includes(l as Locale);

export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
