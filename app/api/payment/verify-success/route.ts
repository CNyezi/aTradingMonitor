import { apiResponse } from '@/lib/api-response';
import { syncSubscriptionData } from '@/lib/stripe/actions';
import stripe from '@/lib/stripe/stripe';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import Stripe from 'stripe';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return apiResponse.unauthorized();
  }

  const sessionId = req.nextUrl.searchParams.get('session_id');
  if (!sessionId) {
    return apiResponse.badRequest('Missing session_id parameter');
  }

  if (!stripe) {
    return apiResponse.serverError('Stripe is not initialized. Please check your environment variables.');
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items', 'payment_intent', 'subscription']
    });

    if (session.metadata?.userId !== user.id) {
      console.warn(`User ID mismatch! Auth User: ${user.id}, Session Meta User: ${session.metadata?.userId}, Session: ${sessionId}`);
      return apiResponse.forbidden('User ID mismatch.');
    }
    if (session.status !== 'complete') {
      return apiResponse.badRequest(`Checkout session status is not complete (${session.status})`);
    }

    try {
      if (session.mode === 'subscription' && session.subscription) {
        const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
        const custId = typeof session.customer === 'string' ? session.customer : (session.customer as Stripe.Customer)?.id;

        if (!subId || !custId) {
          console.error(`[Verify API] Missing subscription or customer ID for session ${sessionId}`);
          return apiResponse.serverError('Could not verify subscription details.');
        }

        try {
          await syncSubscriptionData(subId, custId, session.metadata);
        } catch (syncError) {
          console.error(`[Verify API] Error during fallback sync for session ${sessionId}:`, syncError);
        }

        const { data: activeSubscription, error: subCheckError } = await supabaseAdmin
          .from('subscriptions')
          .select('id, plan_id, status, metadata')
          .eq('stripe_subscription_id', subId)
          .eq('user_id', user.id)
          .in('status', ['active', 'trialing'])
          .maybeSingle();

        if (subCheckError) {
          console.error(`[Verify API] DB error checking subscription ${subId}:`, subCheckError);
          return apiResponse.serverError('Failed to verify subscription status in database.');
        }

        if (!activeSubscription) {
          console.warn(`[Verify API] Subscription ${subId} not found or not active/trialing in DB for user ${user.id}. Status might be pending webhook processing.`);
          return apiResponse.success({
            message: 'Payment successful! Subscription activation may take a moment. Please refresh shortly.',
          });
        } else {
          return apiResponse.success({
            subscriptionId: activeSubscription.id,
            planName: activeSubscription.metadata?.planName,
            planId: activeSubscription.plan_id,
            status: activeSubscription.status,
            message: 'Subscription verified and active.',
          });
        }
      } else if (session.mode === 'payment' && session.payment_intent) {
        if (session.payment_status !== 'paid') {
          return apiResponse.badRequest(`Payment status is not paid (${session.payment_status})`);
        }

        const piId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent.id;
        const { data: existingOrder, error: orderCheckError } = await supabaseAdmin
          .from('orders')
          .select('id, metadata')
          .eq('provider', 'stripe')
          .eq('provider_order_id', piId)
          .eq('user_id', user.id)
          .eq('order_type', 'one_time_purchase')
          .eq('status', 'succeeded')
          .maybeSingle();

        if (orderCheckError) {
          console.error(`[Verify API] DB error checking order for PI ${piId}:`, orderCheckError);
          return apiResponse.serverError('Failed to verify payment status in database.');
        }

        if (!existingOrder) {
          console.warn(`[Verify API] Order for PI ${piId} not found via webhook. Consider adding creation logic here as fallback.`);
          return apiResponse.success({
            message: 'Payment successful! Order confirmation may take a moment. Please refresh shortly.',
          });
        } else {
          const message = 'Payment verified and order confirmed.';
          return apiResponse.success({
            orderId: existingOrder.id,
            planName: existingOrder.metadata?.planName,
            planId: existingOrder.metadata?.planId,
            message: message
          });
        }
      }
    } catch (syncError) {
      console.error(`[Verify API] Error during fallback sync for session ${sessionId}:`, syncError);
      return apiResponse.badRequest('Invalid session type for verification.');
    }

  } catch (error: any) {
    console.error(`Error retrieving/verifying checkout session ${sessionId}:`, error);
    const clientMessage = error?.message?.includes('No such checkout.session') ? 'Invalid session ID.' : 'Failed to verify payment.';
    return apiResponse.serverError(clientMessage);
  }
} 