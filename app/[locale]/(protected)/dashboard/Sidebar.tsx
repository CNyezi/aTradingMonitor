"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Link as I18nLink, usePathname } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import React from "react";

type Menu = {
  name: string;
  href: string;
};

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  setOpenMobile?: (open: boolean) => void;
}

export function Sidebar({ className, setOpenMobile }: SidebarProps) {
  const { user } = useAuth();
  const pathname = usePathname();

  const t = useTranslations("Login");

  const userMenus: Menu[] = t.raw("UserMenus");
  const adminMenus: Menu[] = t.raw("AdminMenus");

  const isActive = (href: string) => pathname === href;

  const handleLinkClick = () => {
    if (setOpenMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <div className={cn("pb-12 flex flex-col h-full", className)}>
      <div className="mt-4 flex-1">
        <div className="px-3 py-2">
          <div className="space-y-1">
            {userMenus.map((menu) => (
              <Button
                key={menu.href}
                variant="ghost"
                className={cn(
                  "w-full justify-start gap-x-2 font-normal",
                  isActive(menu.href) &&
                    "bg-muted text-primary hover:bg-muted/15 font-medium"
                )}
                asChild
                onClick={handleLinkClick}
              >
                <I18nLink href={menu.href} title={menu.name} prefetch={true}>
                  <span>{menu.name}</span>
                </I18nLink>
              </Button>
            ))}
          </div>
        </div>

        {user?.role === "admin" && (
          <>
            <Separator className="my-4" />
            <div className="px-3 py-2">
              <div className="text-xs font-semibold text-muted-foreground tracking-wider uppercase mb-2 px-4">
                Admin Menus
              </div>
              <div className="space-y-1">
                {adminMenus.map((menu) => (
                  <Button
                    key={menu.href}
                    variant="ghost"
                    className={cn(
                      "w-full justify-start gap-x-2 font-normal",
                      isActive(menu.href) &&
                        "bg-muted text-primary hover:bg-muted/15 font-medium"
                    )}
                    asChild
                    onClick={handleLinkClick}
                  >
                    <I18nLink
                      href={menu.href}
                      title={menu.name}
                      prefetch={false}
                    >
                      <span>{menu.name}</span>
                    </I18nLink>
                  </Button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
