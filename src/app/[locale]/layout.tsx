import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { Toaster } from "sonner";
import { isRtl, routing } from "@/i18n/routing";
import "../globals.css";

export const metadata: Metadata = {
  title: { default: "IT Manager", template: "%s · IT Manager" },
  description: "Gestion d'équipe, matériel et projets pour les équipes IT.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0e" },
  ],
};

// Applique le thème avant le premier rendu (pas de flash).
const themeScript = `(function(){try{var t=localStorage.getItem('itm-theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark')}catch(e){}})()`;

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    <html lang={locale} dir={isRtl(locale) ? "rtl" : "ltr"} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <NextIntlClientProvider>
          {children}
          <Toaster position="top-center" richColors closeButton toastOptions={{ className: "!rounded-xl !text-[13px]" }} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
