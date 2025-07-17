"use client";

import FeatureBadge from "@/components/shared/FeatureBadge";
import { Button } from "@/components/ui/button";
import { RainbowButton } from "@/components/ui/rainbow-button";
import { motion } from "framer-motion";
import { BookOpen, MousePointerClick } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export default function Hero() {
  const t = useTranslations("Landing.Hero");
  const titles = useMemo(() => t.raw("animatedTitles") || [], [t]);

  const [titleNumber, setTitleNumber] = useState(0);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (titleNumber === titles.length - 1) {
        setTitleNumber(0);
      } else {
        setTitleNumber(titleNumber + 1);
      }
    }, 2000);
    return () => clearTimeout(timeoutId);
  }, [titleNumber, titles]);

  return (
    <div className="w-full">
      <div className="container mx-auto">
        <div className="flex gap-8 py-16 lg:py-24 2xl:py-36 items-center justify-center flex-col">
          <FeatureBadge label="NEW" text={t("badge")} />
          <div className="flex gap-4 flex-col max-w-3xl">
            <h1 className="text-center z-10 text-lg md:text-7xl font-sans font-bold">
              <span className="bg-clip-text bg-gradient-to-b from-foreground to-muted-foreground text-transparent">
                {t("title")}
              </span>
              <span className="relative w-full flex justify-center overflow-hidden text-center md:pb-4 md:pt-1">
                &nbsp;
                {titles.map((title: string, index: number) => (
                  <motion.span
                    key={index}
                    className="absolute font-semibold gradient-bg text-white"
                    initial={{ opacity: 0, y: "-100" }}
                    transition={{ type: "spring", stiffness: 50 }}
                    animate={
                      titleNumber === index
                        ? {
                            y: 0,
                            opacity: 1,
                          }
                        : {
                            y: titleNumber > index ? -150 : 150,
                            opacity: 0,
                          }
                    }
                  >
                    {title}
                  </motion.span>
                ))}
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
            <Button
              className="h-11 rounded-xl px-8 py-2"
              variant="outline"
              asChild
            >
              <Link
                href={t("viewDocsLink") || "#"}
                className="flex items-center gap-2"
              >
                <BookOpen className="w-4 h-4" />
                {t("viewDocs")}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
