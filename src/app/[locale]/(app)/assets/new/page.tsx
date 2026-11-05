import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { requireContext } from "@/server/context";
import { nextAssetTag, supplierOptions } from "@/server/assets";
import { PageHeader } from "@/components/ui/misc";
import { AssetForm } from "@/components/assets/asset-form";

export default async function NewAssetPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const ctx = await requireContext("asset.write");
  const t = await getTranslations("assets");
  const [suppliers, tag] = await Promise.all([supplierOptions(ctx), nextAssetTag(ctx.orgId)]);
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={t("new")} breadcrumb={<Link href="/assets" className="hover:text-fg">{t("title")}</Link>} />
      <AssetForm suppliers={suppliers} suggestedTag={tag} currency={ctx.org.currency} />
    </div>
  );
}
