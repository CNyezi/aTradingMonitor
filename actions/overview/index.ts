'use server';

import { actionResponse, ActionResult } from '@/lib/action-response';
import { getErrorMessage } from '@/lib/error-utils';
import { Database } from '@/lib/supabase/types';
import { createClient as createAdminClient } from '@supabase/supabase-js';

interface IStats {
  today: number;
  yesterday: number;
  growthRate: number;
  total?: number;
}

interface IOrderStats {
  count: IStats;
  revenue: IStats;
}

interface IOrderStatsResult {
  oneTime: { count: number; revenue: number };
  monthly: { count: number; revenue: number };
  yearly: { count: number; revenue: number };
}

export interface IOverviewStats {
  users: IStats;
  oneTimePayments: IOrderStats;
  monthlySubscriptions: IOrderStats;
  yearlySubscriptions: IOrderStats;
}

export interface IDailyGrowthStats {
  report_date: string;
  new_users_count: number;
  new_orders_count: number;
}

const supabaseAdmin = createAdminClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function calculateGrowthRate(today: number, yesterday: number): number {
  if (yesterday === 0) {
    return today > 0 ? Infinity : 0;
  }
  return ((today - yesterday) / yesterday) * 100;
}

export const getOverviewStats = async (): Promise<ActionResult<IOverviewStats>> => {
  // if (!(await isAdmin())) {
  //   return actionResponse.forbidden('Admin privileges required.');
  // }
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const yesterdayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 1
    ).toISOString();

    // User stats
    const { count: totalUsers } = await supabaseAdmin
      .from('users')
      .select('id', { count: 'exact' });
    const todayUsers =
      (await supabaseAdmin.from('users').select('id', { count: 'exact' }).gte('created_at', todayStart))
        .count ?? 0;
    const yesterdayUsers =
      (
        await supabaseAdmin
          .from('users')
          .select('id', { count: 'exact' })
          .gte('created_at', yesterdayStart)
          .lt('created_at', todayStart)
      ).count ?? 0;

    // Order stats
    const getOrderStatsForPeriod = async (startDate: string, endDate: string) => {
      const { data, error } = await supabaseAdmin.rpc('get_order_stats_for_period', {
        start_date_param: startDate,
        end_date_param: endDate,
      });

      if (error) {
        console.error('Error fetching order stats via RPC:', error);
        throw new Error('An error occurred while fetching order statistics.');
      }

      return data as unknown as IOrderStatsResult;
    };

    const todayOrderStats = await getOrderStatsForPeriod(todayStart, new Date().toISOString());
    const yesterdayOrderStats = await getOrderStatsForPeriod(yesterdayStart, todayStart);

    const stats: IOverviewStats = {
      users: {
        today: todayUsers,
        yesterday: yesterdayUsers,
        growthRate: calculateGrowthRate(todayUsers, yesterdayUsers),
        total: totalUsers ?? 0,
      },
      oneTimePayments: {
        count: {
          today: todayOrderStats.oneTime.count,
          yesterday: yesterdayOrderStats.oneTime.count,
          growthRate: calculateGrowthRate(
            todayOrderStats.oneTime.count,
            yesterdayOrderStats.oneTime.count
          ),
        },
        revenue: {
          today: todayOrderStats.oneTime.revenue,
          yesterday: yesterdayOrderStats.oneTime.revenue,
          growthRate: calculateGrowthRate(
            todayOrderStats.oneTime.revenue,
            yesterdayOrderStats.oneTime.revenue
          ),
        },
      },
      monthlySubscriptions: {
        count: {
          today: todayOrderStats.monthly.count,
          yesterday: yesterdayOrderStats.monthly.count,
          growthRate: calculateGrowthRate(
            todayOrderStats.monthly.count,
            yesterdayOrderStats.monthly.count
          ),
        },
        revenue: {
          today: todayOrderStats.monthly.revenue,
          yesterday: yesterdayOrderStats.monthly.revenue,
          growthRate: calculateGrowthRate(
            todayOrderStats.monthly.revenue,
            yesterdayOrderStats.monthly.revenue
          ),
        },
      },
      yearlySubscriptions: {
        count: {
          today: todayOrderStats.yearly.count,
          yesterday: yesterdayOrderStats.yearly.count,
          growthRate: calculateGrowthRate(
            todayOrderStats.yearly.count,
            yesterdayOrderStats.yearly.count
          ),
        },
        revenue: {
          today: todayOrderStats.yearly.revenue,
          yesterday: yesterdayOrderStats.yearly.revenue,
          growthRate: calculateGrowthRate(
            todayOrderStats.yearly.revenue,
            yesterdayOrderStats.yearly.revenue
          ),
        },
      },
    };
    return actionResponse.success(stats);
  } catch (error) {
    return actionResponse.error(getErrorMessage(error));
  }
};

export const getDailyGrowthStats = async (
  period: '7d' | '30d' | '90d'
): Promise<ActionResult<IDailyGrowthStats[]>> => {
  // if (!(await isAdmin())) {
  //   return actionResponse.forbidden('Admin privileges required.');
  // }
  try {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case '7d':
        startDate = new Date(new Date().setDate(now.getDate() - 7));
        break;
      case '30d':
        startDate = new Date(new Date().setMonth(now.getMonth() - 1));
        break;
      case '90d':
        startDate = new Date(new Date().setMonth(now.getMonth() - 3));
        break;
      default:
        // This should not happen due to TypeScript types, but it's good practice
        // to handle it.
        throw new Error('Invalid period specified.');
    }

    const { data, error } = await supabaseAdmin.rpc('get_daily_growth_stats', {
      start_date_param: startDate.toISOString(),
    });

    if (error) {
      throw new Error(
        'Failed to fetch daily growth stats: ' +
        (error instanceof Error ? error.message : String(error))
      );
    }
    return actionResponse.success(data ?? []);
  } catch (error) {
    return actionResponse.error(getErrorMessage(error));
  }
};