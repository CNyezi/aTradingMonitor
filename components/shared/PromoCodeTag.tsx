"use client";

import { Button } from "@/components/ui/button";
import { Copy, Tag } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

interface PromoCodeProps {
  code: string;
  discount: string;
  expiryDate?: string;
}

export default function PromoCodeTag({
  code,
  discount,
  expiryDate,
}: PromoCodeProps) {
  const [isCopied, setIsCopied] = useState(false);
  const t = useTranslations("Shared.promoCode");

  const copyToClipboard = () => {
    navigator.clipboard.writeText(code);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="flex justify-center my-4">
      <div className="inline-flex items-center rounded-lg bg-white dark:bg-gray-800 shadow-sm border border-indigo-200 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center px-3 py-2 bg-indigo-50 dark:bg-indigo-900/30 border-r border-indigo-200 dark:border-gray-700">
          <Tag className="h-4 w-4 text-indigo-600 dark:text-indigo-400 mr-2" />
          <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
            {t("limitedTimeOffer")}: {t("save", { discount })}
          </span>
        </div>

        <div className="px-3 py-2 flex items-center border-r border-indigo-200 dark:border-gray-700">
          <code className="font-mono font-medium text-sm text-gray-800 dark:text-gray-200">
            {code}
          </code>
        </div>

        <Button
          onClick={copyToClipboard}
          variant="ghost"
          size="sm"
          className="px-3 h-full text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-none"
        >
          {isCopied ? t("copied") : <Copy className="h-3.5 w-3.5" />}
        </Button>

        {expiryDate && (
          <div className="hidden sm:flex items-center pl-2 pr-3 text-xs text-gray-500 dark:text-gray-400">
            {t("validUntil")}: {expiryDate}
          </div>
        )}
      </div>
    </div>
  );
}
