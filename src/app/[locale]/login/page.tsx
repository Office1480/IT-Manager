import { getTranslations, setRequestLocale } from "next-intl/server";
import { LoginForm } from "./login-form";

export default async function LoginPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ next?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { next } = await searchParams;
  const t = await getTranslations("auth");
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-bg px-4">
      <div aria-hidden className="pointer-events-none absolute inset-0 [background:radial-gradient(60rem_30rem_at_50%_-10%,var(--accent-soft),transparent)]" />
      <div className="relative w-full max-w-sm animate-in">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex size-11 items-center justify-center rounded-2xl bg-accent text-lg font-bold text-white shadow-md">IT</div>
          <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-[13px] text-fg-muted">{t("subtitle")}</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-md">
          <LoginForm next={next} />
        </div>
        {process.env.NODE_ENV !== "production" && <p className="mt-4 text-center text-xs text-fg-subtle">{t("demo")}</p>}
      </div>
    </main>
  );
}
