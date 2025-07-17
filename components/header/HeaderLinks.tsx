"use client";

import { Link as I18nLink, usePathname } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { HeaderLink } from "@/types/common";
import { useTranslations } from "next-intl";

const HeaderLinks = () => {
  const tHeader = useTranslations("Header");
  const pathname = usePathname();

  const headerLinks: HeaderLink[] = tHeader.raw("links");
  const pricingLink = headerLinks.find((link) => link.id === "pricing");
  if (pricingLink) {
    pricingLink.href = process.env.NEXT_PUBLIC_PRICING_PATH!;
  }

  return (
    <div className="hidden md:flex flex-row items-center gap-x-2 text-sm text-muted-foreground">
      {headerLinks.map((link) => (
        <I18nLink
          key={link.name}
          href={link.href}
          title={link.name}
          prefetch={link.target && link.target === "_blank" ? false : true}
          target={link.target || "_self"}
          rel={link.rel || undefined}
          className={cn(
            "rounded-xl px-4 py-2 hover:bg-accent-foreground/10 hover:text-accent-foreground",
            pathname === link.href && "font-medium text-accent-foreground"
          )}
        >
          {link.name}
        </I18nLink>
      ))}
    </div>
  );
};

export default HeaderLinks;
