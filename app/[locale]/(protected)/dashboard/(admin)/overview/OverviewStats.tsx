import { getOverviewStats } from "@/actions/overview";
import { getTranslations } from "next-intl/server";
import { CombinedStatCard } from "./CombinedStatCard";
import { StatCard } from "./StatCard";

export async function OverviewStats() {
  const t = await getTranslations("Overview");
  const result = await getOverviewStats();

  if (!result.success) {
    return (
      <div className="flex items-center justify-center h-full min-h-36">
        <p className="text-red-500">
          {result.error || "Failed to load dashboard data."}
        </p>
      </div>
    );
  }

  if (!result.data) {
    return (
      <div className="flex items-center justify-center h-full min-h-36">
        <p className="text-gray-500">No data available.</p>
      </div>
    );
  }

  const stats = result.data;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title={t("newUsers")}
        today={stats.users.today}
        yesterday={stats.users.yesterday}
        growthRate={stats.users.growthRate}
        total={stats.users.total}
        t={t}
      />
      <CombinedStatCard
        title={t("oneTimePayments")}
        count={stats.oneTimePayments.count}
        revenue={stats.oneTimePayments.revenue}
        t={t}
      />
      <CombinedStatCard
        title={t("monthlySubscriptions")}
        count={stats.monthlySubscriptions.count}
        revenue={stats.monthlySubscriptions.revenue}
        t={t}
      />
      <CombinedStatCard
        title={t("yearlySubscriptions")}
        count={stats.yearlySubscriptions.count}
        revenue={stats.yearlySubscriptions.revenue}
        t={t}
      />
    </div>
  );
}
