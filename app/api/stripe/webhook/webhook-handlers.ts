import {
  sendCreditUpgradeFailedEmail,
  sendInvoicePaymentFailedEmail,
  syncSubscriptionData,
} from '@/actions/stripe';
import { db } from '@/lib/db';
import {
  creditLogs as creditLogsSchema,
  orders as ordersSchema,
  pricingPlans as pricingPlansSchema,
  usage as usageSchema,
} from '@/lib/db/schema';
import { stripe } from '@/lib/stripe';
import { and, eq, inArray, InferInsertModel, sql } from 'drizzle-orm';
import Stripe from 'stripe';

type Order = typeof ordersSchema.$inferSelect;

/**
 * Handles the `checkout.session.completed` event from Stripe.
 *
 * - For one-time payments, it creates an order record and grants credits.
 * - For subscriptions, it triggers the initial subscription sync.
 *
 * @param session The Stripe Checkout Session object.
 */
export async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const planId = session.metadata?.planId;
  const priceId = session.metadata?.priceId;

  if (!userId || !planId || !priceId) {
    console.error('Critical metadata (userId, planId, priceId) missing in checkout session:', session.id, session.metadata);
    return;
  }

  if (session.mode === 'payment') {
    let paymentIntentId = session.payment_intent as string;

    if (!paymentIntentId) {
      console.error('Payment Intent ID missing from completed checkout session (mode=payment):', session.id);
      // return;
      paymentIntentId = session.id;
    }

    /**
     * Idempotency Check
     * 幂等性检查
     * 冪等性チェック
     */
    const existingOrderResults = await db
      .select({ id: ordersSchema.id })
      .from(ordersSchema)
      .where(and(
        eq(ordersSchema.provider, 'stripe'),
        eq(ordersSchema.providerOrderId, paymentIntentId)
      ))
      .limit(1);

    if (existingOrderResults.length > 0) {
      return;
    }

    const orderData: InferInsertModel<typeof ordersSchema> = {
      userId: userId,
      provider: 'stripe',
      providerOrderId: paymentIntentId,
      stripePaymentIntentId: paymentIntentId,
      status: 'succeeded',
      orderType: 'one_time_purchase',
      planId: planId,
      priceId: priceId,
      amountSubtotal: session.amount_subtotal ? (session.amount_subtotal / 100).toString() : null,
      amountDiscount: session.total_details?.amount_discount ? (session.total_details.amount_discount / 100).toString() : '0',
      amountTax: session.total_details?.amount_tax ? (session.total_details.amount_tax / 100).toString() : '0',
      amountTotal: session.amount_total ? (session.amount_total / 100).toString() : '0',
      currency: session.currency || process.env.NEXT_PUBLIC_DEFAULT_CURRENCY || 'usd',
      metadata: {
        stripeCheckoutSessionId: session.id,
        ...session.metadata
      }
    };

    const insertedOrderResults = await db
      .insert(ordersSchema)
      .values(orderData)
      .returning({ id: ordersSchema.id });

    const insertedOrder = insertedOrderResults[0];

    if (!insertedOrder) {
      console.error('Error inserting one-time purchase order');
      throw new Error('Could not insert order');
    }

    // --- [custom] Upgrade the user's benefits ---
    const orderId = insertedOrder.id;
    try {
      await upgradeOneTimeCredits(userId, planId, orderId);
    } catch (error) {
      console.error(`CRITICAL: Failed to upgrade one-time credits for user ${userId}, order ${orderId}:`, error);
      await sendCreditUpgradeFailedEmail({ userId, orderId, planId, error });
      throw error;
    }
    // --- End: [custom] Upgrade the user's benefits ---
  }
}

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
 * Handles the `invoice.paid` event from Stripe.
 *
 * - Primarily for subscription renewals/payments.
 * - Creates an order record for the invoice.
 * - Grants/Resets subscription credits in the usage table.
 *
 * @param invoice The Stripe Invoice object.
 */
export async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const subscriptionId = typeof invoice.parent?.subscription_details?.subscription === 'string' ? invoice.parent?.subscription_details?.subscription : null;
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : null;
  const invoiceId = invoice.id;

  if (invoice.status !== 'paid' || !subscriptionId || !customerId || !invoiceId || !invoice.billing_reason?.startsWith('subscription')) {
    console.warn(`Invoice ${invoiceId ?? 'N/A'} is not a paid subscription invoice or missing essential IDs. Status: ${invoice.status}, Subscription: ${subscriptionId}, Customer: ${customerId}, Billing Reason: ${invoice.billing_reason}. Skipping.`);
    return;
  }

  /**
   * Idempotency Check
   * 幂等性检查
   * 冪等性チェック
   */
  const existingOrderResults = await db
    .select({ id: ordersSchema.id })
    .from(ordersSchema)
    .where(and(
      eq(ordersSchema.provider, 'stripe'),
      eq(ordersSchema.providerOrderId, invoiceId)
    ))
    .limit(1);

  if (existingOrderResults.length > 0) {
    // order exists, but we still want to sync subscription and potentially grant credits
  } else {

    if (!stripe) {
      console.error('Stripe is not initialized. Please check your environment variables.');
      return;
    }

    let userId: string | null = null;
    let planId: string | null = null;
    let priceId: string | null = null;
    let productId: string | null = null;
    let subscription: Stripe.Subscription | null = null;

    try {
      subscription = await stripe.subscriptions.retrieve(subscriptionId);
      userId = subscription.metadata?.userId;
      planId = subscription.metadata?.planId;
      if (subscription.items.data.length > 0) {
        priceId = subscription.items.data[0].price.id;
        productId = typeof subscription.items.data[0].price.product === 'string'
          ? subscription.items.data[0].price.product
          : (subscription.items.data[0].price.product as Stripe.Product)?.id;
      }

      if (!userId && customerId) {
        const customer = await stripe.customers.retrieve(customerId);
        if (customer && !customer.deleted) {
          userId = customer.metadata?.userId ?? null;
        }
      }

      if (!planId && priceId) {
        const planDataResults = await db
          .select({ id: pricingPlansSchema.id })
          .from(pricingPlansSchema)
          .where(eq(pricingPlansSchema.stripePriceId, priceId))
          .limit(1);
        planId = planDataResults[0]?.id ?? null;
      }
    } catch (subError) {
      console.error(`Error fetching subscription ${subscriptionId} or related data during invoice.paid handling:`, subError);
      if (!userId) {
        throw new Error(`Failed to retrieve subscription ${subscriptionId} and cannot determine userId for invoice ${invoiceId}.`);
      }
      console.warn(`Could not fully populate order details for invoice ${invoiceId} due to error: ${subError instanceof Error ? subError.message : subError}`);
    }

    if (!userId) {
      console.error(`FATAL: User ID could not be determined for invoice ${invoiceId}. Cannot create order.`);
      throw new Error(`User ID determination failed for invoice ${invoiceId}.`);
    }
    if (!planId) {
      console.warn(`Could not determine planId for subscription ${subscriptionId} from invoice ${invoiceId}. Order created, but credit grant may fail.`);
    }

    const invoiceData = await stripe!.invoices.retrieve(invoice.id as string, { expand: ['payments'] });
    const paymentIntentId = invoiceData.payments?.data[0]?.payment.payment_intent as string | null;

    const orderType = invoice.billing_reason === 'subscription_create' ? 'subscription_initial' : 'subscription_renewal';
    const orderData: InferInsertModel<typeof ordersSchema> = {
      userId: userId,
      provider: 'stripe',
      providerOrderId: invoiceId,
      stripePaymentIntentId: paymentIntentId,
      stripeInvoiceId: invoiceId,
      subscriptionId: subscriptionId,
      status: 'succeeded',
      orderType: orderType,
      planId: planId,
      priceId: priceId,
      productId: productId,
      amountSubtotal: (invoice.subtotal / 100).toString(),
      amountDiscount: ((invoice.total_discount_amounts?.reduce((sum, disc) => sum + disc.amount, 0) ?? 0) / 100).toString(),
      amountTax: ((invoice.total_taxes?.reduce((sum, tax) => sum + tax.amount, 0) ?? 0) / 100).toString(),
      amountTotal: (invoice.amount_paid / 100).toString(),
      currency: invoice.currency,
      metadata: {
        stripeInvoiceId: invoice.id,
        stripeSubscriptionId: subscriptionId,
        stripeCustomerId: customerId,
        billingReason: invoice.billing_reason,
        ...(invoice.metadata || {}),
      }
    };

    const insertedOrderResults = await db
      .insert(ordersSchema)
      .values(orderData)
      .returning({ id: ordersSchema.id });
    const insertedOrder = insertedOrderResults[0];

    if (!insertedOrder) {
      console.error(`Error inserting order for invoice ${invoiceId}`);
      throw new Error('Could not insert order');
    }

    if (planId && userId && subscription) {
      // --- [custom] Upgrade the user's benefits ---
      const orderId = insertedOrder.id;
      try {
        await upgradeSubscriptionCredits(userId, planId, orderId, subscription);
      } catch (error) {
        console.error(`CRITICAL: Failed to upgrade subscription credits for user ${userId}, order ${orderId}:`, error);
        await sendCreditUpgradeFailedEmail({ userId, orderId, planId, error });
        throw error;
      }
      // --- End: [custom] Upgrade the user's benefits ---
    } else {
      console.warn(`Cannot grant subscription credits for invoice ${invoiceId} because planId (${planId}) or userId (${userId}) is unknown.`);
    }
  }

  try {
    await syncSubscriptionData(subscriptionId, customerId);
  } catch (syncError) {
    console.error(`Error during post-invoice sync for sub ${subscriptionId}:`, syncError);
  }
}

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

/**
 * Handles subscription update events (`created`, `updated`, `deleted`).
 * Calls syncSubscriptionData to update the central subscription record in `orders`.
 *
 * @param subscription The Stripe Subscription object.
 */
export async function handleSubscriptionUpdate(subscription: Stripe.Subscription, isDeleted: boolean = false) {
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : null;

  if (!customerId) {
    console.error(`Customer ID missing on subscription object: ${subscription.id}. Cannot sync.`);
    return;
  }

  try {
    await syncSubscriptionData(subscription.id, customerId, subscription.metadata);

    if (isDeleted) {
      // --- [custom] Revoke the user's benefits---
      revokeRemainingSubscriptionCreditsOnEnd(subscription);
      // --- End: [custom] Revoke the user's benefits ---
    }
  } catch (error) {
    console.error(`Error syncing subscription ${subscription.id} during update event:`, error);
    throw error;
  }
}

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
 * Handles the `invoice.payment_failed` event from Stripe.
 * Calls syncSubscriptionData to update the central subscription record in `orders`.
 *
 * @param invoice The Stripe Invoice object.
 */
export async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = typeof invoice.parent?.subscription_details?.subscription === 'string' ? invoice.parent?.subscription_details?.subscription : null;
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : null;
  const invoiceId = invoice.id;

  if (!subscriptionId || !customerId || !invoiceId) {
    console.warn(`Skipping invoice.payment_failed handler for invoice ${invoiceId ?? 'N/A'}: Could not determine subscriptionId (${subscriptionId}) or customerId (${customerId}).`);
    return;
  }

  // Sync the subscription state (likely becomes 'past_due' or 'unpaid')
  try {
    await syncSubscriptionData(subscriptionId, customerId);
  } catch (syncError) {
    console.error(`Error syncing subscription ${subscriptionId} during invoice.payment_failed handling for invoice ${invoiceId}:`, syncError);
    throw syncError;
  }

  // Send notification email
  try {
    await sendInvoicePaymentFailedEmail({
      invoice,
      subscriptionId,
      customerId,
      invoiceId
    });
  } catch (emailError) {
    console.error(`Error sending payment failed email for invoice ${invoiceId}:`, emailError);
  }
}

/**
 * Handles the `charge.refunded` event.
 *
 * - Creates a refund order record.
 * - Implement logic to revoke credits granted by the original purchase.
 *
 * @param charge The Stripe Charge object (specifically the refunded charge).
 */
export async function handleRefund(charge: Stripe.Charge) {
  if (!charge.refunded) {
    return;
  }

  const chargeId = charge.id;
  const paymentIntentId = charge.payment_intent as string | null;
  const customerId = typeof charge.customer === 'string' ? charge.customer : null;

  if (!chargeId || !paymentIntentId) {
    console.error(`Refund ID missing from refunded charge: ${charge.id}. Cannot process refund fully.`);
    return;
  }
  if (!customerId) {
    console.error(`Customer ID missing from refunded charge: ${charge.id}. Cannot process refund fully.`);
    return;
  }

  const existingRefundOrderResults = await db
    .select({ id: ordersSchema.id })
    .from(ordersSchema)
    .where(and(
      eq(ordersSchema.provider, 'stripe'),
      eq(ordersSchema.providerOrderId, chargeId),
      eq(ordersSchema.orderType, 'refund')
    ))
    .limit(1);

  if (existingRefundOrderResults.length > 0) {
    // already refunded
    return;
  }

  const originalOrderResults = await db
    .select()
    .from(ordersSchema)
    .where(and(
      eq(ordersSchema.provider, 'stripe'),
      eq(ordersSchema.stripePaymentIntentId, paymentIntentId),
      inArray(ordersSchema.orderType, ['one_time_purchase', 'subscription_initial', 'subscription_renewal'])
    ))
    .limit(1);
  const originalOrder = originalOrderResults[0];

  if (!originalOrder) {
    console.error(`Original order for payment intent ${paymentIntentId} not found.`);
    return;
  } else {
    const isFullRefund =
      Math.abs(charge.amount_refunded) === Math.round(parseFloat(originalOrder.amountTotal!) * 100);

    await db
      .update(ordersSchema)
      .set({ status: isFullRefund ? 'refunded' : 'partially_refunded' })
      .where(eq(ordersSchema.id, originalOrder.id));
  }

  if (!stripe) {
    console.error('Stripe is not initialized. Please check your environment variables.');
    return;
  }

  let userId: string | null = null;
  const customer = await stripe.customers.retrieve(customerId);
  if (!(customer as Stripe.DeletedCustomer).deleted) {
    userId = (customer as Stripe.Customer).metadata?.userId ?? null;
  }

  if (!userId) {
    console.error(`Customer ID missing from refunded charge: ${charge.id}. Cannot process refund fully.`);
    return;
  }

  const refundAmount = charge.amount_refunded / 100;
  const refundData: InferInsertModel<typeof ordersSchema> = {
    userId: originalOrder.userId ?? userId,
    provider: 'stripe',
    providerOrderId: chargeId,
    stripePaymentIntentId: paymentIntentId,
    stripeChargeId: chargeId,
    status: 'succeeded',
    orderType: 'refund',
    planId: originalOrder.planId ?? null,
    priceId: null,
    productId: null,
    amountSubtotal: null,
    amountDiscount: null,
    amountTax: null,
    amountTotal: (-refundAmount).toString(),
    currency: charge.currency,
    subscriptionId: null,
    metadata: {
      stripeChargeId: charge.id,
      stripePaymentIntentId: paymentIntentId,
      originalOrderId: originalOrder?.id ?? null,
      refundReason: charge.refunds?.data[0]?.reason,
      ...(charge.metadata || {}),
    }
  };

  const refundOrderResults = await db
    .insert(ordersSchema)
    .values(refundData)
    .returning({ id: ordersSchema.id });
  const refundOrder = refundOrderResults[0];

  if (!refundOrder) {
    throw new Error(`Error inserting refund order for refund ${chargeId}`);
  }

  // --- [custom] Revoke the user's benefits  ---
  if (originalOrder.subscriptionId) {
    revokeSubscriptionCredits(charge, originalOrder);
  } else {
    revokeOneTimeCredits(charge, originalOrder, refundOrder.id);
  }
  // --- End: [custom] Revoke the user's benefits ---
}

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

/**
 * Handles the `radar.early_fraud_warning.created` event.
 * Initiates a refund for the fraudulent charge.
 *
 * @param warning The Stripe Radar Early Fraud Warning object.
 */
export async function handleEarlyFraudWarningCreated(warning: Stripe.Radar.EarlyFraudWarning) {
  const chargeId = warning.charge;
  if (typeof chargeId !== 'string') {
    console.error('Charge ID missing from early fraud warning:', warning.id);
    return;
  }

  if (!stripe) {
    console.error('Stripe is not initialized. Please check your environment variables.');
    return;
  }

  try {
    const charge = (await stripe.charges.retrieve(chargeId)) as any;

    if (!charge.refunded) {
      await stripe.refunds.create({
        charge: chargeId,
        reason: 'fraudulent',
      });
      console.log(`Refund for charge ${chargeId}.`);

      // if the charge is a subscription, delete the latest subscription
      if (charge.description?.includes('Subscription')) {
        const customerId = charge.customer as string;
        const subscription = await stripe.subscriptions.list({
          customer: customerId,
          limit: 1,
        });
        const latestSubscription = subscription.data[0] || null;
        latestSubscription?.id && await stripe.subscriptions.cancel(latestSubscription?.id as string);
        console.log(`Deleted subscription ${latestSubscription?.id}.`);
      }
    } else {
      console.log(`Charge ${chargeId} already refunded.`);
    }
  } catch (error) {
    console.error(`Error handling early fraud warning ${warning.id} for charge ${chargeId}:`, error);
    throw error;
  }
}