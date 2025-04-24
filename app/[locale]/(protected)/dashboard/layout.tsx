import React from "react";
import { MobileSidebar } from "./MobileSidebar";
import { Sidebar } from "./Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background w-full">
      <div className="md:hidden border-b px-4 py-3 sticky top-0 z-10 bg-background backdrop-blur-sm">
        <MobileSidebar />
      </div>
      <div className="flex flex-1">
        <Sidebar className="hidden md:block w-56 border-r p-4 sticky top-0 h-screen scrollbar-thin" />
        <main className="flex-1 p-4 md:p-6 mx-auto">{children}</main>
      </div>
    </div>
  );
}
