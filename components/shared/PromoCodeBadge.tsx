"use client";

import { useRouter } from "@/i18n/routing";
import { Check, Copy, Tag } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

interface PromoCodeBadgeProps {
  code: string;
  discount: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export default function PromoCodeBadge({
  code,
  discount,
  className = "",
  size = "md",
}: PromoCodeBadgeProps) {
  const [isCopied, setIsCopied] = useState(false);
  const router = useRouter();
  const t = useTranslations("Shared.promoCode");

  const copyToClipboard = () => {
    router.push(t("goToPricing"));
    navigator.clipboard.writeText(code);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const sizeStyles = {
    sm: "text-xs py-1 px-2",
    md: "text-sm py-1.5 px-3",
    lg: "text-base py-2 px-4",
  };

  return (
    <div
      className={`my-4 inline-flex items-center bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 font-medium rounded-full ${sizeStyles[size]} ${className}`}
    >
      <Tag className="w-4 h-4 mr-1" />

      <span>
        {t("limitedTimeOffer")}: {t("save", { discount })}
      </span>

      <div className="font-mono font-bold mx-1">{code}</div>

      <button
        onClick={copyToClipboard}
        className="ml-1 focus:outline-none hover:text-green-800 dark:hover:text-green-300 transition-colors"
        aria-label={t("copyAndScroll")}
        title={t("copyAndScroll")}
      >
        {isCopied ? (
          <Check
            className={`${
              size === "sm" ? "w-3 h-3" : size === "lg" ? "w-5 h-5" : "w-4 h-4"
            }`}
          />
        ) : (
          <Copy
            className={`${
              size === "sm" ? "w-3 h-3" : size === "lg" ? "w-5 h-5" : "w-4 h-4"
            }`}
          />
        )}
      </button>
    </div>
  );
}
