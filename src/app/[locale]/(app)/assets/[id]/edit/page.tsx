import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { requireContext } from "@/server/context";
import { getAsset, supplierOptions } from "@/server/assets";
import { PageHeader } from "@/components/ui/misc";
import { AssetForm } from "@/components/assets/asset-form";

export default async function EditAssetPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const ctx = await requireContext("asset.write");
  const t = await getTranslations("assets");
  const [asset, suppliers] = await Promise.all([getAsset(ctx, id), supplierOptions(ctx)]);
  const name = `${asset.brand} ${asset.model}`;
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={t("editTitle", { name })} breadcrumb={<><Link href="/assets" className="hover:text-fg">{t("title")}</Link> / <Link href={`/assets/${id}`} className="hover:text-fg">{asset.assetTag}</Link></>} />
      <AssetForm initial={{ ...asset, purchasePrice: asset.purchasePrice?.toString(), replacementCost: asset.replacementCost?.toString() }} suppliers={suppliers} currency={ctx.org.currency} />
    </div>
  );
}
