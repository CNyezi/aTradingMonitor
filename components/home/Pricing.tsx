import { getPublicPricingPlans } from "@/app/actions/getPricingPlan";
import PricingCTA from "@/components/home/PricingCTA";
import { PricingPlan } from "@/types/pricing";
import { Check, X } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

const defaultBorderStyle = "border-gray-300 dark:border-gray-600";
const defaultCtaStyle = "bg-gray-800 hover:bg-gray-700";
const highlightedBorderStyle = "border-indigo-600 dark:border-indigo-400";
const highlightedCtaStyle = "gradient-bg hover:opacity-90";

export default async function Pricing() {
  const t = await getTranslations("Landing.Pricing");

  const locale = await getLocale();

  const newPlans: PricingPlan[] = await getPublicPricingPlans();

  return (
    <section id="pricing" className="py-20 bg-white dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            {t("title")
              .split(t("titleHighlight"))
              .map((part, i) =>
                i === 0 ? (
                  part
                ) : (
                  <span key={part}>
                    <span className="gradient-text">{t("titleHighlight")}</span>
                    {part}
                  </span>
                )
              )}
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            {t("description")}
          </p>
        </div>

        <div
          className={`grid grid-cols-1  gap-8 md:grid-cols-${newPlans.length}`}
        >
          {newPlans.map((plan) => {
            const localizedPlan =
              plan.lang_jsonb?.[locale] || plan.lang_jsonb?.["en"];

            if (!localizedPlan) {
              console.error(
                `Missing localization for locale '${locale}' or fallback 'en' for plan ID ${plan.id}`
              );
              return null;
            }

            return (
              <div
                key={plan.id}
                className={`card rounded-xl p-8 shadow-sm border-t-4 ${
                  plan.is_highlighted
                    ? highlightedBorderStyle
                    : defaultBorderStyle
                } ${
                  plan.is_highlighted
                    ? "shadow-lg transform scale-105 relative z-10"
                    : ""
                }`}
              >
                {plan.is_highlighted && localizedPlan.highlight_text && (
                  <div className="absolute top-0 right-0 bg-indigo-600 text-white text-xs px-3 py-1 rounded-bl-lg rounded-tr-lg font-medium">
                    {localizedPlan.highlight_text}
                  </div>
                )}
                <h3 className="text-2xl font-bold mb-2">
                  {localizedPlan.card_title || plan.card_title}
                </h3>
                <p className="text-muted-foreground mb-6 h-[3rem]">
                  {localizedPlan.card_description || plan.card_description}
                </p>
                <PricingCTA
                  plan={plan}
                  localizedPlan={localizedPlan}
                  defaultCtaStyle={defaultCtaStyle}
                  highlightedCtaStyle={highlightedCtaStyle}
                />
                <div className="text-4xl font-bold mb-6">
                  {localizedPlan.original_price || plan.original_price ? (
                    <span className="text-xl line-through decoration-2 font-normal text-muted-foreground mr-2">
                      {localizedPlan.original_price || plan.original_price}
                    </span>
                  ) : null}

                  {localizedPlan.display_price || plan.display_price}

                  {localizedPlan.price_suffix || plan.price_suffix ? (
                    <span className="text-lg font-normal text-muted-foreground">
                      /
                      {localizedPlan.price_suffix?.replace(/^\/+/, "") ||
                        plan.price_suffix?.replace(/^\/+/, "")}
                    </span>
                  ) : null}
                </div>
                <ul className="space-y-3 mb-6">
                  {localizedPlan.features?.map(
                    (feature: { description: string; included: boolean }) => (
                      <li
                        key={feature.description}
                        className="flex items-start"
                      >
                        {feature.included ? (
                          <Check className="text-green-500 h-5 w-5 mt-1 mr-3 flex-shrink-0" />
                        ) : (
                          <X className="text-red-500 h-5 w-5 mt-1 mr-3 flex-shrink-0 opacity-50" />
                        )}
                        <span className={feature.included ? "" : "opacity-50"}>
                          {feature.description}
                        </span>
                      </li>
                    )
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
