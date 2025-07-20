import FeatureBadge from "@/components/shared/FeatureBadge";
import { RainbowButton } from "@/components/ui/rainbow-button";
import { MousePointerClick } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

export default function Hero() {
  const t = useTranslations("Landing.Hero");

  return (
    <div className="w-full">
      <div className="container mx-auto">
        <div className="flex gap-8 py-16 lg:py-24 2xl:py-40 items-center justify-center flex-col">
          <FeatureBadge
            label={t("badge.label")}
            text={t("badge.text")}
            href={t("badge.href")}
          />
          <div className="flex gap-4 flex-col max-w-3xl">
            <h1 className="text-center z-10 text-lg md:text-7xl font-sans font-bold">
              <span className="bg-clip-text bg-gradient-to-b from-foreground to-muted-foreground text-transparent">
                {t("title")}
              </span>
            </h1>

            <p className="text-lg md:text-xl leading-relaxed tracking-tight text-muted-foreground text-center">
              {t("description")}
            </p>
          </div>
          <div className="flex flex-row gap-2">
            <RainbowButton>
              <Link
                href={t("getStartedLink") || "#"}
                className="flex items-center gap-2"
              >
                <MousePointerClick className="w-4 h-4" />
                {t("getStarted")}
              </Link>
            </RainbowButton>
          </div>
        </div>
      </div>
    </div>
  );
}
