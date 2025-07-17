import FeatureBadge from "@/components/shared/FeatureBadge";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";

type Feature = {
  icon: string;
  title: string;
  description: string;
};

// const FeatureCard = ({ feature }: { feature: Feature }) => {
//   return (
//     <div
//       key={feature.title}
//       className="card rounded-xl p-6 shadow-sm hover:shadow-md dark:shadow-indigo-900/10"
//     >
//       <div className="w-14 h-14 rounded-lg flex items-center justify-center mb-4 gradient-bg text-white">
//         {feature.icon && (
//           <DynamicIcon name={feature.icon} className="size-6 shrink-0" />
//         )}
//       </div>
//       <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
//       <p className="text-gray-600 dark:text-gray-400">{feature.description}</p>
//     </div>
//   );
// };

const FeatureCard = ({ feature }: { feature: Feature }) => {
  return (
    <div key={feature.title} className="w-full py-4">
      <div className="container mx-auto">
        <div className="grid border rounded-lg container p-8 grid-cols-1 gap-8 items-center lg:grid-cols-2">
          <div className="flex gap-10 flex-col">
            <div className="flex gap-4 flex-col">
              <div className="flex gap-2 flex-col">
                <h3 className="text-3xl lg:text-5xl tracking-tighter max-w-xl text-left font-regular">
                  Something new!
                </h3>
                <p className="text-lg leading-relaxed tracking-tight text-muted-foreground max-w-xl text-left">
                  Managing a small business today is already tough.
                </p>
              </div>
            </div>
            <div className="grid lg:pl-6 grid-cols-1 sm:grid-cols-3 items-start lg:grid-cols-1 gap-6">
              <div className="flex flex-row gap-6 items-start">
                <Check className="w-4 h-4 mt-2 text-primary" />
                <div className="flex flex-col gap-1">
                  <p>Easy to use</p>
                  <p className="text-muted-foreground text-sm">
                    We&apos;ve made it easy to use and understand.
                  </p>
                </div>
              </div>
              <div className="flex flex-row gap-6 items-start">
                <Check className="w-4 h-4 mt-2 text-primary" />
                <div className="flex flex-col gap-1">
                  <p>Fast and reliable</p>
                  <p className="text-muted-foreground text-sm">
                    We&apos;ve made it fast and reliable.
                  </p>
                </div>
              </div>
              <div className="flex flex-row gap-6 items-start">
                <Check className="w-4 h-4 mt-2 text-primary" />
                <div className="flex flex-col gap-1">
                  <p>Beautiful and modern</p>
                  <p className="text-muted-foreground text-sm">
                    We&apos;ve made it beautiful and modern.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-muted rounded-md aspect-square"></div>
        </div>
      </div>
    </div>
  );
};

export default function Features() {
  const t = useTranslations("Landing.Features");

  const features: Feature[] = t.raw("items").map((item: any) => ({
    icon: item.icon,
    title: item.title,
    description: item.description,
  }));

  return (
    <section id="features" className="py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <FeatureBadge label="FEATURES" text={t("badge")} />
          <h2 className="text-3xl md:text-4xl font-bold mb-4">{t("title")}</h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
            {t("description")}
          </p>
        </div>

        <div className="">
          {features.map((feature) => (
            <FeatureCard key={feature.title} feature={feature} />
          ))}
        </div>
      </div>
    </section>
  );
}
