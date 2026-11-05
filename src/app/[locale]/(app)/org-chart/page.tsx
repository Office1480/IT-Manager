import { setRequestLocale } from "next-intl/server";
import { requireContext } from "@/server/context";
import { PlaceholderPage } from "@/components/placeholder-page";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  await requireContext();
  return <PlaceholderPage titleKey="orgChart" />;
}
