import { getTranslations, setRequestLocale } from "next-intl/server";
import { Lock } from "lucide-react";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";

export default async function ForbiddenPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const t = await getTranslations();
  return (
    <Card>
      <EmptyState icon={<Lock />} title={t("common.forbidden")} action={<Button asChild><Link href="/">{t("nav.dashboard")}</Link></Button>} />
    </Card>
  );
}
