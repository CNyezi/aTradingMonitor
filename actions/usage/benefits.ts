'use server';

import { db } from '@/db';
import { subscriptions, usage } from '@/db/schema';
import { actionResponse, ActionResult } from '@/lib/action-response';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { desc, eq } from 'drizzle-orm';

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface UserBenefits {
  activePlanId: string | null;
  subscriptionStatus: string | null; // e.g., 'active', 'trialing', 'past_due', 'canceled', null
  currentPeriodEnd: string | null;
  nextCreditDate: string | null;
  totalAvailableCredits: number;
  subscriptionCreditsBalance: number;
  oneTimeCreditsBalance: number;
  // Add other plan-specific benefits if needed, fetched via planId
}

interface UsageData {
  subscription_credits_balance: number | null;
  one_time_credits_balance: number | null;
  balance_jsonb: any;
}

interface SubscriptionData {
  plan_id: string;
  status: string;
  current_period_end: string | null;
}

const defaultUserBenefits: UserBenefits = {
  activePlanId: null,
  subscriptionStatus: null,
  currentPeriodEnd: null,
  nextCreditDate: null,
  totalAvailableCredits: 0,
  subscriptionCreditsBalance: 0,
  oneTimeCreditsBalance: 0,
};

function createUserBenefitsFromData(
  usageData: UsageData | null,
  subscription: SubscriptionData | null,
  currentYearlyDetails: any | null = null
): UserBenefits {
  const subCredits = (usageData?.subscription_credits_balance ?? 0) as number;
  const oneTimeCredits = (usageData?.one_time_credits_balance ?? 0) as number;
  const totalCredits = subCredits + oneTimeCredits;

  const currentPeriodEnd = subscription?.current_period_end ?? null;
  const nextCreditDate = currentYearlyDetails?.next_credit_date ?? null;

  let finalStatus = subscription?.status ?? null;
  if (finalStatus && subscription?.current_period_end && new Date(subscription.current_period_end) < new Date()) {
    finalStatus = 'inactive_period_ended';
  }

  return {
    activePlanId: (finalStatus === 'active' || finalStatus === 'trialing') ? subscription?.plan_id ?? null : null,
    subscriptionStatus: finalStatus,
    currentPeriodEnd,
    nextCreditDate,
    totalAvailableCredits: totalCredits,
    subscriptionCreditsBalance: subCredits,
    oneTimeCreditsBalance: oneTimeCredits,
  };
}

async function fetchSubscriptionData(
  userId: string
): Promise<SubscriptionData | null> {
  try {
    const result = await db
      .select({
        plan_id: subscriptions.plan_id,
        status: subscriptions.status,
        current_period_end: subscriptions.current_period_end,
      })
      .from(subscriptions)
      .where(eq(subscriptions.user_id, userId))
      .orderBy(desc(subscriptions.created_at))
      .limit(1);

    if (result.length > 0) {
      const sub = result[0];
      return {
        ...sub,
        current_period_end: sub.current_period_end
          ? new Date(sub.current_period_end).toISOString()
          : null,
      };
    }

    return null;
  } catch (error) {
    console.error(
      `Unexpected error in fetchSubscriptionData for user ${userId}:`,
      error
    );
    return null;
  }
}

/**
 * Retrieves the user's current benefits including plan, status, and credit balances.
 *
 * @param userId The UUID of the user.
 * @returns A promise resolving to the UserBenefits object.
 */
export async function getUserBenefits(userId: string): Promise<UserBenefits> {
  if (!userId) {
    return defaultUserBenefits;
  }

  try {
    const result = await db
      .select({
        subscription_credits_balance: usage.subscription_credits_balance,
        one_time_credits_balance: usage.one_time_credits_balance,
        balance_jsonb: usage.balance_jsonb,
      })
      .from(usage)
      .where(eq(usage.user_id, userId));

    const usageData = result.length > 0 ? result[0] : null;

    let finalUsageData: UsageData | null = usageData as UsageData | null;

    // ------------------------------------------
    // User with no usage data, it means he/she is a new user
    // Reference: handleWelcomeCredits on https://github.com/WeNextDev/nexty-flux-kontext/blob/main/actions/usage/benefits.ts
    // ------------------------------------------
    // if (!usageData) {
    //   console.log(`New user(${userId}) with no usage data - may grant benefits if needed.`);
    //   finalUsageData = someFunctionToGrantBenefits(userId);
    // }

    // ------------------------------------------
    // Handle user subscription data (subscriptions table) and benefits data (usage table)
    // ------------------------------------------
    if (finalUsageData) {
      let currentBalanceJsonb = finalUsageData.balance_jsonb as any;
      let currentYearlyDetails = currentBalanceJsonb?.yearly_allocation_details;

      // Start of Yearly Subscription Catch-up Logic
      while (
        currentYearlyDetails &&
        currentYearlyDetails.remaining_months &&
        currentYearlyDetails.remaining_months > 0 &&
        currentYearlyDetails.next_credit_date &&
        new Date() >= new Date(currentYearlyDetails.next_credit_date)
      ) {
        const creditsToAllocate = currentYearlyDetails.monthly_credits;
        const yearMonthToAllocate = new Date(
          currentYearlyDetails.next_credit_date
        )
          .toISOString()
          .slice(0, 7);

        console.log(
          `Attempting to allocate credits for user ${userId}, month ${yearMonthToAllocate}, remaining: ${currentYearlyDetails.remaining_months}`
        );

        const { error: rpcError } = await supabaseAdmin.rpc(
          'allocate_specific_monthly_credit_for_year_plan',
          {
            p_user_id: userId,
            p_monthly_credits: creditsToAllocate,
            p_current_yyyy_mm: yearMonthToAllocate,
          }
        );

        if (rpcError) {
          console.error(
            `Catch-up: Error calling allocate_specific_monthly_credit_for_year_plan for user ${userId}, month ${yearMonthToAllocate}:`,
            rpcError
          );
          break;
        } else {
          console.log(
            `Catch-up: Successfully allocated or skipped for user ${userId}, month ${yearMonthToAllocate}. Re-fetching usage data.`
          );
          const updatedResult = await db
            .select({
              subscription_credits_balance: usage.subscription_credits_balance,
              one_time_credits_balance: usage.one_time_credits_balance,
              balance_jsonb: usage.balance_jsonb,
            })
            .from(usage)
            .where(eq(usage.user_id, userId));

          const updatedUsageData =
            updatedResult.length > 0 ? updatedResult[0] : null;

          if (!updatedUsageData) {
            console.warn(
              `Catch-up: Usage data disappeared for user ${userId} after allocation. Stopping.`
            );
            finalUsageData = null;
            break;
          }

          finalUsageData = updatedUsageData as UsageData;
          currentBalanceJsonb = finalUsageData.balance_jsonb as any;
          currentYearlyDetails =
            currentBalanceJsonb?.yearly_allocation_details;

          if (!currentYearlyDetails) {
            console.log(
              `Catch-up: yearly_allocation_details no longer present for user ${userId} after allocation. Stopping loop.`
            );
            break;
          }
        }
      }
      // End of Yearly Subscription Catch-up Logic

      const subscription = await fetchSubscriptionData(userId);

      return createUserBenefitsFromData(
        finalUsageData,
        subscription,
        currentYearlyDetails
      );
    } else {
      const subscription = await fetchSubscriptionData(userId);

      return createUserBenefitsFromData(null, subscription);
    }
  } catch (error) {
    console.error(`Unexpected error in getUserBenefits for user ${userId}:`, error);
    return defaultUserBenefits;
  }
}

export async function getClientUserBenefits(): Promise<ActionResult<UserBenefits>> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return actionResponse.unauthorized();
  }

  try {
    const benefits = await getUserBenefits(user.id);
    return actionResponse.success(benefits);
  } catch (error: any) {
    console.error("Error fetching user benefits for client:", error);
    return actionResponse.error(
      error.message || "Failed to fetch user benefits."
    );
  }
}