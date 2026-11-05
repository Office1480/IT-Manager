import { getTranslations } from "next-intl/server";
import { Construction } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";

export async function PlaceholderPage({ titleKey }: { titleKey: string }) {
  const t = await getTranslations();
  return (
    <>
      <PageHeader title={t(`nav.${titleKey}`)} />
      <Card><EmptyState icon={<Construction />} title={t("placeholder.title")} description={t("placeholder.description")} /></Card>
    </>
  );
}
