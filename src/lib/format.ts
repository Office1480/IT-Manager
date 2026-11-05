import type { Locale } from "@/i18n/routing";

const intlLocale: Record<string, string> = { fr: "fr-FR", en: "en-GB", he: "he-IL" };

export function fmtDate(d: Date | string | null | undefined, locale: Locale | string, opts?: Intl.DateTimeFormatOptions) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat(intlLocale[locale] ?? locale, { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC", ...opts }).format(date);
}

export function fmtMoney(v: unknown, locale: Locale | string, currency = "ILS") {
  if (v == null) return "—";
  const n = typeof v === "number" ? v : Number(v);
  return new Intl.NumberFormat(intlLocale[locale] ?? locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

export function fmtNumber(v: number, locale: Locale | string, digits = 0) {
  return new Intl.NumberFormat(intlLocale[locale] ?? locale, { maximumFractionDigits: digits }).format(v);
}
