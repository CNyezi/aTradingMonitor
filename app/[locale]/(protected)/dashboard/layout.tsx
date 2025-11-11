import { AuthGuard } from "@/components/auth/AuthGuard";
import SidebarInsetHeader from "@/components/header/SidebarInsetHeader";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { DashboardProviders } from "@/components/providers/DashboardProviders";
import React from "react";
import { DashboardSidebar } from "./DashboardSidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <DashboardProviders>
        <SidebarProvider>
          <DashboardSidebar />
          <SidebarInset>
            <SidebarInsetHeader />
            <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
              <div className="min-h-screen flex-1 rounded-xl md:min-h-min">
                {children}
              </div>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </DashboardProviders>
    </AuthGuard>
  );
}
