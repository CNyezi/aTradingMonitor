import { constructMetadata } from "@/lib/metadata";
import { Metadata } from "next";
import { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { PricePlanForm } from "../PricePlanForm";

type Params = Promise<{ locale: string }>;

type MetadataProps = {
  params: Params;
};

export async function generateMetadata({
  params,
}: MetadataProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: "Dashboard.Admin.Prices.CreatePlan",
  });

  return constructMetadata({
    page: "PricesNew",
    title: t("title"),
    description: t("description"),
    locale: locale as Locale,
    path: `/dashboard/prices/new`,
  });
}

export default async function NewPricePlanPage() {
  const t = await getTranslations("Dashboard.Admin.Prices.CreatePlan");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
      </div>
      <PricePlanForm initialData={null} />
    </div>
  );
}
