import { DEFAULT_LOCALE } from '@/i18n/routing';
import { apiResponse } from '@/lib/api-response';
import { isAdmin } from '@/lib/supabase/isAdmin';
import { Database, Json } from '@/lib/supabase/types';
import { PricingPlan } from '@/types/pricing';
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import { NextRequest } from 'next/server';

// POST /api/admin/pricing-plans - Create a new plan
export async function POST(request: NextRequest) {
  if (!(await isAdmin())) {
    return apiResponse.unauthorized();
  }

  const { get } = await headers();
  const locale = get("Accept-Language");

  const t = await getTranslations({ locale: locale || DEFAULT_LOCALE, namespace: 'Dashboard.Admin.Prices.API' });

  let planData: Partial<PricingPlan>;
  try {
    planData = await request.json();
  } catch (e) {
    return apiResponse.badRequest(t("invalidJsonBody"));
  }

  if (!planData.environment || !planData.card_title) {
    return apiResponse.badRequest(t("missingRequiredFields"));
  }

  if (planData.lang_jsonb && typeof planData.lang_jsonb !== 'object') {
    try {
      if (typeof planData.lang_jsonb === 'string') {
        planData.lang_jsonb = JSON.parse(planData.lang_jsonb as string);
      } else {
        return apiResponse.badRequest(t("invalidLangJsonbFormat"));
      }
    } catch (e) {
      return apiResponse.badRequest(t("invalidJsonFormatInLangJsonbString"));
    }
  }

  if (planData.benefits_jsonb && typeof planData.benefits_jsonb !== 'object') {
    try {
      if (typeof planData.benefits_jsonb === 'string') {
        planData.benefits_jsonb = JSON.parse(planData.benefits_jsonb as string);
      } else {
        return apiResponse.badRequest(t("invalidBenefitsJsonFormat"));
      }
    } catch (e) {
      return apiResponse.badRequest(t("invalidJsonFormatInBenefitsString"));
    }
  }

  try {
    const supabaseAdmin = createAdminClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data, error } = await supabaseAdmin
      .from('pricing_plans')
      .insert({
        environment: planData.environment,
        card_title: planData.card_title,
        card_description: planData.card_description,
        stripe_price_id: planData.stripe_price_id,
        stripe_product_id: planData.stripe_product_id,
        payment_type: planData.payment_type,
        recurring_interval: planData.recurring_interval,
        price: planData.price,
        currency: planData.currency,
        display_price: planData.display_price,
        original_price: planData.original_price,
        price_suffix: planData.price_suffix,
        is_highlighted: planData.is_highlighted ?? false,
        highlight_text: planData.highlight_text,
        button_text: planData.button_text,
        button_link: planData.button_link,
        display_order: planData.display_order ?? 0,
        is_active: planData.is_active ?? true,
        features: (planData.features || []) as unknown as Json,
        lang_jsonb: (planData.lang_jsonb || {}) as unknown as Json,
        benefits_jsonb: (planData.benefits_jsonb || {}) as unknown as Json,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating pricing plan:', error);
      if (error.code === '23505') { // Unique violation
        return apiResponse.conflict(t("createPlanConflict", { message: error.message }));
      }
      return apiResponse.serverError(t("createPlanServerError"));
    }

    return apiResponse.success(data);
  } catch (err) {
    console.error('Unexpected error creating pricing plan:', err);
    return apiResponse.serverError(t("createPlanServerError"));
  }
}