import { useTranslations } from "next-intl";
import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/ui/misc";

export default function NotFound() {
  const t = useTranslations("common");
  return <EmptyState icon={<SearchX />} title={t("notFound")} />;
}
