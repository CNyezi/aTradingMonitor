import { db } from '@/lib/db';
import {
  creditLogs as creditLogsSchema,
  pricingPlans as pricingPlansSchema,
  usage as usageSchema,
} from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import Stripe from 'stripe';

/**
 * Upgrades one-time credits for a user based on their plan purchase.
 * 
 * 根据用户购买的计划为用户升级一次性积分。
 * 
 * ユーザーのプラン購入に基づいて、ユーザーのワンタイムクレジットをアップグレードします。
 */
export async function upgradeOneTimeCredits(userId: string, planId: string, orderId: string) {
  // --- TODO: [custom] Upgrade the user's benefits ---
  /**
   * Complete the user's benefit upgrade based on your business logic.
   * We recommend defining benefits in the `benefitsJsonb` field within your pricing plans (accessible in the dashboard at /dashboard/prices). This code upgrades the user's benefits based on those defined benefits.
   * The following code provides an example using `oneTimeCredits`.  Modify the code below according to your specific business logic if you need to upgrade other benefits.
   * 
   * 根据你的业务逻辑，为用户完成权益升级。
   * 我们建议在定价方案的 `benefitsJsonb` 字段中（可在仪表板的 /dashboard/prices 访问）定义权益。此代码会根据定义的权益，为用户完成权益升级。
   * 以下代码以 `oneTimeCredits` 为例。如果你需要升级其他权益，请根据你的具体业务逻辑修改以下代码。
   * 
   * お客様のビジネスロジックに基づいて、ユーザーの特典アップグレードを完了させてください。
   * 特典は、料金プランの `benefitsJsonb` フィールド（ダッシュボードの /dashboard/prices でアクセス可能）で定義することをお勧めします。このコードは、定義された特典に基づいて、ユーザーの特典をアップグレードします。
   * 以下のコードは、`oneTimeCredits` を使用した例です。他の特典をアップグレードする必要がある場合は、お客様のビジネスロジックに従って、以下のコードを修正してください。
   */
  const planDataResults = await db
    .select({ benefitsJsonb: pricingPlansSchema.benefitsJsonb })
    .from(pricingPlansSchema)
    .where(eq(pricingPlansSchema.id, planId))
    .limit(1);
  const planData = planDataResults[0];

  if (!planData) {
    throw new Error(`Could not fetch plan benefits for ${planId}`);
  }

  const creditsToGrant = (planData.benefitsJsonb as any)?.oneTimeCredits || 0;

  if (creditsToGrant && creditsToGrant > 0) {
    let attempts = 0;
    const maxAttempts = 3;
    let lastError: any = null;

    while (attempts < maxAttempts) {
      attempts++;
      try {
        await db.transaction(async (tx) => {
          const updatedUsage = await tx
            .insert(usageSchema)
            .values({
              userId: userId,
              oneTimeCreditsBalance: creditsToGrant,
            })
            .onConflictDoUpdate({
              target: usageSchema.userId,
              set: {
                oneTimeCreditsBalance: sql`${usageSchema.oneTimeCreditsBalance} + ${creditsToGrant}`,
              },
            })
            .returning({
              oneTimeBalanceAfter: usageSchema.oneTimeCreditsBalance,
              subscriptionBalanceAfter: usageSchema.subscriptionCreditsBalance,
            });

          const balances = updatedUsage[0];
          if (!balances) {
            throw new Error('Failed to update usage and get new balances.');
          }

          await tx.insert(creditLogsSchema).values({
            userId: userId,
            amount: creditsToGrant,
            oneTimeBalanceAfter: balances.oneTimeBalanceAfter,
            subscriptionBalanceAfter: balances.subscriptionBalanceAfter,
            type: 'one_time_purchase',
            notes: 'One-time credit purchase',
            relatedOrderId: orderId,
          });
        });
        console.log(`Successfully granted one-time credits for user ${userId} on attempt ${attempts}.`);
        return; // Success, exit the function
      } catch (error) {
        lastError = error;
        console.warn(`Attempt ${attempts} failed for grant one-time credits and log for user ${userId}. Retrying in ${attempts}s...`, (lastError as Error).message);
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, attempts * 1000));
        }
      }
    }

    if (lastError) {
      console.error(`Error updating usage (one-time credits, userId: ${userId}, creditsToGrant: ${creditsToGrant}) after ${maxAttempts} attempts:`, lastError);
      throw lastError;
    }
  } else {
    console.log(`No one-time credits defined or amount is zero for plan ${planId}. Skipping credit grant.`);
  }
  // --- End: [custom] Upgrade the user's benefits ---
}

/**
 * Upgrades subscription credits for a user based on their subscription plan.
 * Handles both monthly and yearly subscription intervals.
 * 
 * 根据用户的订阅计划为用户升级订阅积分。
 * 处理月度和年度订阅间隔。
 * 
 * ユーザーのサブスクリプションプランに基づいて、ユーザーのサブスクリプションクレジットをアップグレードします。
 * 月次および年次のサブスクリプション間隔を処理します。
 */
export async function upgradeSubscriptionCredits(userId: string, planId: string, orderId: string, subscription: Stripe.Subscription) {
  // --- TODO: [custom] Upgrade the user's benefits ---
  /**
   * Complete the user's benefit upgrade based on your business logic.
   * We recommend defining benefits in the `benefitsJsonb` field within your pricing plans (accessible in the dashboard at /dashboard/prices). This code upgrades the user's benefits based on those defined benefits.
   * The following code provides an example using `monthlyCredits`.  Modify the code below according to your specific business logic if you need to upgrade other benefits.
   * 
   * 根据你的业务逻辑，为用户完成权益升级。
   * 我们建议在定价方案的 `benefitsJsonb` 字段中（可在仪表板的 /dashboard/prices 访问）定义权益。此代码会根据定义的权益，为用户完成权益升级。
   * 以下代码以 `monthlyCredits` 为例。如果你需要升级其他权益，请根据你的具体业务逻辑修改以下代码。
   * 
   * お客様のビジネスロジックに基づいて、ユーザーの特典アップグレードを完了させてください。
   * 特典は、料金プランの `benefitsJsonb` フィールド（ダッシュボードの /dashboard/prices でアクセス可能）で定義することをお勧めします。このコードは、定義された特典に基づいて、ユーザーの特典をアップグレードします。
   * 以下のコードは、`monthlyCredits` を使用した例です。他の特典をアップグレードする必要がある場合は、お客様のビジネスロジックに従って、以下のコードを修正してください。
   */
  try {
    const planDataResults = await db
      .select({
        recurringInterval: pricingPlansSchema.recurringInterval,
        benefitsJsonb: pricingPlansSchema.benefitsJsonb
      })
      .from(pricingPlansSchema)
      .where(eq(pricingPlansSchema.id, planId))
      .limit(1);
    const planData = planDataResults[0];

    if (!planData) {
      console.error(`Error fetching plan benefits for planId ${planId} during order ${orderId} processing`);
      throw new Error(`Could not fetch plan benefits for ${planId}`);
    } else {
      const benefits = planData.benefitsJsonb as any;
      const recurringInterval = planData.recurringInterval;

      const creditsToGrant = benefits?.monthlyCredits || 0;

      if (recurringInterval === 'month' && creditsToGrant) {
        let attempts = 0;
        const maxAttempts = 3;
        let lastError: any = null;

        while (attempts < maxAttempts) {
          attempts++;
          try {
            await db.transaction(async (tx) => {
              const monthlyDetails = {
                monthlyAllocationDetails: {
                  monthlyCredits: creditsToGrant,
                  relatedOrderId: orderId,
                }
              };

              const updatedUsage = await tx
                .insert(usageSchema)
                .values({
                  userId: userId,
                  subscriptionCreditsBalance: creditsToGrant,
                  balanceJsonb: monthlyDetails,
                })
                .onConflictDoUpdate({
                  target: usageSchema.userId,
                  set: {
                    subscriptionCreditsBalance: creditsToGrant,
                    balanceJsonb: sql`coalesce(${usageSchema.balanceJsonb}, '{}'::jsonb) - 'monthlyAllocationDetails' || ${JSON.stringify(monthlyDetails)}::jsonb`,
                  },
                })
                .returning({
                  oneTimeBalanceAfter: usageSchema.oneTimeCreditsBalance,
                  subscriptionBalanceAfter: usageSchema.subscriptionCreditsBalance,
                });

              const balances = updatedUsage[0];
              if (!balances) { throw new Error('Failed to update usage for monthly subscription'); }

              await tx.insert(creditLogsSchema).values({
                userId: userId,
                amount: creditsToGrant,
                oneTimeBalanceAfter: balances.oneTimeBalanceAfter,
                subscriptionBalanceAfter: balances.subscriptionBalanceAfter,
                type: 'subscription_grant',
                notes: 'Subscription credits granted/reset',
                relatedOrderId: orderId,
              });
            });
            console.log(`Successfully granted subscription credits for user ${userId} on attempt ${attempts}.`);
            lastError = null;
            break;
          } catch (error) {
            lastError = error;
            console.warn(`Attempt ${attempts} failed for grant subscription credits and log for user ${userId}. Retrying in ${attempts}s...`, (lastError as Error).message);
            if (attempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, attempts * 1000));
            }
          }
        }

        if (lastError) {
          console.error(`Error setting subscription credits for user ${userId} (order ${orderId}) after ${maxAttempts} attempts:`, lastError);
          throw lastError;
        }
        return
      }

      if (recurringInterval === 'year' && benefits?.totalMonths && benefits?.monthlyCredits) {
        let attempts = 0;
        const maxAttempts = 3;
        let lastError: any = null;

        while (attempts < maxAttempts) {
          attempts++;
          try {
            await db.transaction(async (tx) => {
              const startDate = new Date(subscription.start_date * 1000);
              const nextCreditDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, startDate.getDate());

              const yearlyDetails = {
                yearlyAllocationDetails: {
                  remainingMonths: benefits.totalMonths - 1,
                  nextCreditDate: nextCreditDate,
                  monthlyCredits: benefits.monthlyCredits,
                  lastAllocatedMonth: `${startDate.getFullYear()}-${(startDate.getMonth() + 1).toString().padStart(2, '0')}`,
                  relatedOrderId: orderId,
                }
              };

              const updatedUsage = await tx
                .insert(usageSchema)
                .values({
                  userId: userId,
                  subscriptionCreditsBalance: benefits.monthlyCredits,
                  balanceJsonb: yearlyDetails,
                })
                .onConflictDoUpdate({
                  target: usageSchema.userId,
                  set: {
                    subscriptionCreditsBalance: benefits.monthlyCredits,
                    balanceJsonb: sql`coalesce(${usageSchema.balanceJsonb}, '{}'::jsonb) - 'yearlyAllocationDetails' || ${JSON.stringify(yearlyDetails)}::jsonb`,
                  }
                })
                .returning({
                  oneTimeBalanceAfter: usageSchema.oneTimeCreditsBalance,
                  subscriptionBalanceAfter: usageSchema.subscriptionCreditsBalance,
                });

              const balances = updatedUsage[0];
              if (!balances) { throw new Error('Failed to update usage for yearly subscription'); }

              await tx.insert(creditLogsSchema).values({
                userId: userId,
                amount: benefits.monthlyCredits,
                oneTimeBalanceAfter: balances.oneTimeBalanceAfter,
                subscriptionBalanceAfter: balances.subscriptionBalanceAfter,
                type: 'subscription_grant',
                notes: 'Yearly plan initial credits granted',
                relatedOrderId: orderId,
              });
            });
            console.log(`Successfully initialized yearly allocation for user ${userId} on attempt ${attempts}.`);
            lastError = null;
            break;
          } catch (error) {
            lastError = error;
            console.warn(`Attempt ${attempts} failed for initialize or reset yearly allocation for user ${userId}. Retrying in ${attempts}s...`, (lastError as Error).message);
            if (attempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, attempts * 1000));
            }
          }
        }

        if (lastError) {
          console.error(`Failed to initialize yearly allocation for user ${userId} after ${maxAttempts} attempts:`, lastError);
          throw lastError;
        }
        return
      }

    }
  } catch (creditError) {
    console.error(`Error processing credits for user ${userId} (order ${orderId}):`, creditError);
    throw creditError;
  }
  // --- End: [custom] Upgrade the user's benefits ---
}

