import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { SetupForm } from "./setup-form";

export const dynamic = "force-dynamic";

export default async function SetupPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if ((await db.user.count()) > 0) redirect(`/${locale}/login`);
  const t = await getTranslations("setup");
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-bg px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute inset-0 [background:radial-gradient(60rem_30rem_at_50%_-10%,var(--accent-soft),transparent)]" />
      <div className="relative w-full max-w-md animate-in">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex size-11 items-center justify-center rounded-2xl bg-accent text-lg font-bold text-white shadow-md">IT</div>
          <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-[13px] text-fg-muted">{t("subtitle")}</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-md"><SetupForm /></div>
      </div>
    </main>
  );
}
