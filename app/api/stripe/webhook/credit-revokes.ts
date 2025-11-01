import { db } from '@/lib/db';
import {
  creditLogs as creditLogsSchema,
  orders as ordersSchema,
  pricingPlans as pricingPlansSchema,
  usage as usageSchema,
} from '@/lib/db/schema';
import { stripe } from '@/lib/stripe';
import { eq } from 'drizzle-orm';
import Stripe from 'stripe';

type Order = typeof ordersSchema.$inferSelect;

/**
 * Revokes remaining subscription credits when a subscription ends.
 * 
 * 当订阅结束时撤销剩余的订阅积分。
 * 
 * サブスクリプションが終了したときに、残りのサブスクリプションクレジットを取り消します。
 */
export async function revokeRemainingSubscriptionCreditsOnEnd(subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : null;

  if (!customerId) {
    console.error(`Customer ID missing on subscription object: ${subscription.id}. Cannot revoke.`);
    return;
  }

  if (!stripe) {
    console.error('Stripe is not initialized. Please check your environment variables.');
    return;
  }

  let userId = subscription.metadata?.userId as string | undefined;

  if (!userId) {
    try {
      const customer = await stripe.customers.retrieve(customerId);
      if (!(customer as Stripe.DeletedCustomer).deleted) {
        userId = (customer as Stripe.Customer).metadata?.userId ?? undefined;
      }
    } catch (err) {
      console.error(`Error retrieving customer ${customerId} for subscription ${subscription.id}:`, err);
    }
  }

  if (!userId) {
    console.error(`Could not determine userId for subscription ${subscription.id} end event.`);
    return;
  }

  try {
    const usageRows = await db
      .select({ subBalance: usageSchema.subscriptionCreditsBalance })
      .from(usageSchema)
      .where(eq(usageSchema.userId, userId))
      .limit(1);
    const amountToRevoke = usageRows[0]?.subBalance ?? 0;

    if (amountToRevoke > 0) {
      await applySubscriptionCreditsRevocation({
        userId,
        amountToRevoke,
        clearMonthly: true,
        clearYearly: true,
        logType: 'subscription_ended_revoke',
        notes: `Subscription ${subscription.id} ended; remaining credits revoked.`,
        relatedOrderId: null,
      });
    }

    console.log(`Revoked remaining subscription credits on end for subscription ${subscription.id}, user ${userId}`);
  } catch (error) {
    console.error(`Error revoking remaining credits for subscription ${subscription.id}:`, error);
  }
}

/**
 * Revokes one-time credits for a refunded order.
 * 
 * 为退款订单撤销一次性积分。
 * 
 * 返金された注文のワンタイムクレジットを取り消します。
 */
export async function revokeOneTimeCredits(charge: Stripe.Charge, originalOrder: Order, refundOrderId: string) {
  // --- TODO: [custom] Revoke the user's one time purchase benefits ---
  /**
   * Complete the user's benefit revoke based on your business logic.
   * We recommend defining benefits in the `benefitsJsonb` field within your pricing plans (accessible in the dashboard at /dashboard/prices). This code revokes the user's benefits based on those defined benefits.
   * The following code provides examples using `oneTimeCredits`.  If you need to revoke other benefits, please modify the code below based on your specific business logic.
   * 
   * 根据你的业务逻辑，取消退款用户的付费权益。
   * 我们建议在定价方案的 `benefitsJsonb` 字段中（可在仪表板的 /dashboard/prices 访问）定义权益。此代码会根据定义的权益，取消退款用户的付费权益。
   * 以下代码以 `oneTimeCredits` 为例。如果你需要取消其他权益，请根据你的具体业务逻辑修改以下代码。
   * 
   * お客様のビジネスロジックに基づいて、ユーザーの特典を取消してください。
   * 特典は、料金プランの `benefitsJsonb` フィールド（ダッシュボードの /dashboard/prices でアクセス可能）で定義することをお勧めします。このコードは、定義された特典に基づいて、ユーザーの特典を取消します。
   * 以下のコードは、`oneTimeCredits` を使用した例です。他の特典を取消する必要がある場合は、お客様のビジネスロジックに従って、以下のコードを修正してください。
   */
  const planId = originalOrder.planId as string;
  const userId = originalOrder.userId as string;

  const isFullRefund = Math.abs(charge.amount_refunded) === Math.round(parseFloat(originalOrder.amountTotal!) * 100);

  if (isFullRefund) {
    const planDataResults = await db
      .select({ benefitsJsonb: pricingPlansSchema.benefitsJsonb })
      .from(pricingPlansSchema)
      .where(eq(pricingPlansSchema.id, planId))
      .limit(1);
    const planData = planDataResults[0];

    if (!planData) {
      console.error(`Error fetching plan benefits for planId ${planId} during refund ${refundOrderId}:`);
    } else {
      let oneTimeToRevoke = 0;
      const benefits = planData.benefitsJsonb as any;

      if (benefits?.oneTimeCredits > 0) {
        oneTimeToRevoke = benefits.oneTimeCredits;
      }

      if (oneTimeToRevoke > 0) {
        try {
          await db.transaction(async (tx) => {
            const usageResults = await tx.select().from(usageSchema).where(eq(usageSchema.userId, userId)).for('update');
            const usage = usageResults[0];

            if (!usage) { return; }

            const newOneTimeBalance = Math.max(0, usage.oneTimeCreditsBalance - oneTimeToRevoke);
            const amountRevoked = usage.oneTimeCreditsBalance - newOneTimeBalance;

            if (amountRevoked > 0) {
              await tx.update(usageSchema)
                .set({ oneTimeCreditsBalance: newOneTimeBalance })
                .where(eq(usageSchema.userId, userId));

              await tx.insert(creditLogsSchema).values({
                userId,
                amount: -amountRevoked,
                oneTimeBalanceAfter: newOneTimeBalance,
                subscriptionBalanceAfter: usage.subscriptionCreditsBalance,
                type: 'refund_revoke',
                notes: `Full refund for order ${originalOrder.id}.`,
                relatedOrderId: originalOrder.id,
              });
            }
          });
          console.log(`Successfully revoked credits for user ${userId} related to refund ${refundOrderId}.`);
        } catch (revokeError) {
          console.error(`Error calling revoke credits and log for user ${userId}, refund ${refundOrderId}:`, revokeError);
        }
      } else {
        console.log(`No credits defined to revoke for plan ${planId}, order type ${originalOrder.orderType} on refund ${refundOrderId}.`);
      }
    }
  } else {
    console.log(`Refund ${charge.id} is not a full refund. Skipping credit revocation. Refunded: ${charge.amount_refunded}, Original Total: ${parseFloat(originalOrder.amountTotal!) * 100}`);
  }
  // --- End: [custom] Revoke the user's one time purchase benefits ---
}

/**
 * Revokes subscription credits for a refunded subscription order.
 * 
 * 为退款的订阅订单撤销订阅积分。
 * 
 * 返金されたサブスクリプション注文のサブスクリプションクレジットを取り消します。
 */
export async function revokeSubscriptionCredits(charge: Stripe.Charge, originalOrder: Order) {
  // --- TODO: [custom] Revoke the user's subscription benefits ---
  /**
   * Complete the user's subscription benefit revocation based on your business logic.
   * 
   * 根据你的业务逻辑，取消用户的订阅权益。
   * 
   * お客様のビジネスロジックに基づいて、ユーザーのサブスクリプション特典を取消してください。
   */
  const planId = originalOrder.planId as string;
  const userId = originalOrder.userId as string;
  const subscriptionId = originalOrder.subscriptionId as string;

  try {
    const ctx = await getSubscriptionRevokeContext(planId, userId);
    if (!ctx) { return; }

    if (ctx.subscriptionToRevoke > 0) {
      await applySubscriptionCreditsRevocation({
        userId,
        amountToRevoke: ctx.subscriptionToRevoke,
        clearMonthly: ctx.clearMonthly,
        clearYearly: ctx.clearYearly,
        logType: 'refund_revoke',
        notes: `Full refund for subscription order ${originalOrder.id}.`,
        relatedOrderId: originalOrder.id,
      });
      console.log(`Successfully revoked subscription credits for user ${userId} related to subscription ${subscriptionId} refund.`);
    }
  } catch (error) {
    console.error(`Error during revokeSubscriptionCredits for user ${userId}, subscription ${subscriptionId}:`, error);
  }
  // --- End: [custom] Revoke the user's subscription benefits ---
}

/**
 * Gets the context for revoking subscription credits based on plan and usage data.
 * 
 * 根据计划和用量数据获取撤销订阅积分的上下文。
 * 
 * プランと使用量データに基づいて、サブスクリプションクレジットを取り消すためのコンテキストを取得します。
 */
async function getSubscriptionRevokeContext(planId: string, userId: string) {
  const planDataResults = await db
    .select({ recurringInterval: pricingPlansSchema.recurringInterval })
    .from(pricingPlansSchema)
    .where(eq(pricingPlansSchema.id, planId))
    .limit(1);
  const planData = planDataResults[0];

  if (!planData) {
    console.error(`Error fetching plan benefits for planId ${planId} while computing revoke context`);
    return null;
  }

  const usageDataResults = await db
    .select({ balanceJsonb: usageSchema.balanceJsonb })
    .from(usageSchema)
    .where(eq(usageSchema.userId, userId))
    .limit(1);
  const usageData = usageDataResults[0];

  if (!usageData) {
    console.error(`Error fetching usage data for user ${userId} while computing revoke context`);
    return { recurringInterval: planData.recurringInterval, subscriptionToRevoke: 0, clearMonthly: false, clearYearly: false };
  }

  let subscriptionToRevoke = 0;
  let clearYearly = false;
  let clearMonthly = false;

  if (planData.recurringInterval === 'year') {
    const yearlyDetails = (usageData.balanceJsonb as any)?.yearlyAllocationDetails;
    subscriptionToRevoke = yearlyDetails?.monthlyCredits || 0;
    clearYearly = true;
  } else if (planData.recurringInterval === 'month') {
    const monthlyDetails = (usageData.balanceJsonb as any)?.monthlyAllocationDetails;
    subscriptionToRevoke = monthlyDetails?.monthlyCredits || 0;
    clearMonthly = true;
  }

  return {
    recurringInterval: planData.recurringInterval,
    subscriptionToRevoke,
    clearMonthly,
    clearYearly,
  };
}

/**
 * Applies subscription credits revocation to the user's account.
 * 
 * 将订阅积分撤销应用到用户账户。
 * 
 * ユーザーアカウントにサブスクリプションクレジットの取り消しを適用します。
 */
async function applySubscriptionCreditsRevocation(params: {
  userId: string;
  amountToRevoke: number;
  clearMonthly?: boolean;
  clearYearly?: boolean;
  logType: string;
  notes: string;
  relatedOrderId?: string | null;
}) {
  const { userId, amountToRevoke, clearMonthly, clearYearly, logType, notes, relatedOrderId } = params;

  if (!amountToRevoke || amountToRevoke <= 0) {
    return;
  }

  await db.transaction(async (tx) => {
    const usageResults = await tx.select().from(usageSchema).where(eq(usageSchema.userId, userId)).for('update');
    const usage = usageResults[0];
    if (!usage) { return; }

    const newSubBalance = Math.max(0, usage.subscriptionCreditsBalance - amountToRevoke);
    const amountRevoked = usage.subscriptionCreditsBalance - newSubBalance;

    let newBalanceJsonb = usage.balanceJsonb as any;
    if (clearYearly) {
      delete newBalanceJsonb?.yearlyAllocationDetails;
    }
    if (clearMonthly) {
      delete newBalanceJsonb?.monthlyAllocationDetails;
    }

    if (amountRevoked > 0) {
      await tx.update(usageSchema)
        .set({
          subscriptionCreditsBalance: newSubBalance,
          balanceJsonb: newBalanceJsonb,
        })
        .where(eq(usageSchema.userId, userId));

      await tx.insert(creditLogsSchema).values({
        userId,
        amount: -amountRevoked,
        oneTimeBalanceAfter: usage.oneTimeCreditsBalance,
        subscriptionBalanceAfter: newSubBalance,
        type: logType,
        notes,
        relatedOrderId: relatedOrderId ?? null,
      });
    }
  });
}

