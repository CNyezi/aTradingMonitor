import { apiResponse } from '@/lib/api-response';
import { isAdmin } from '@/lib/supabase/isAdmin';
import { Json } from '@/lib/supabase/types';
import { PricingPlan } from '@/types/pricing';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import { NextRequest } from 'next/server';

// PUT /api/admin/pricing-plans/{id} - Update a plan by ID
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return apiResponse.unauthorized();
  }

  const supabase = await createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { get } = await headers();
  const locale = get("Accept-Language");

  const t = await getTranslations({ locale: locale || "en", namespace: 'Dashboard.Admin.Prices.API' });

  const { id } = await params;
  if (!id) {
    return apiResponse.badRequest(t("missingPlanId"));
  }

  let planData: Partial<PricingPlan>;
  try {
    planData = await request.json();
  } catch (e) {
    return apiResponse.badRequest(t("invalidJsonBody"));
  }

  if (planData.lang_jsonb && typeof planData.lang_jsonb === 'string') {
    try {
      planData.lang_jsonb = JSON.parse(planData.lang_jsonb as string);
    } catch (e) {
      return apiResponse.badRequest(t("invalidJsonFormatInLangJsonbString"));
    }
  } else if (planData.lang_jsonb && typeof planData.lang_jsonb !== 'object' && planData.lang_jsonb !== null) {
    return apiResponse.badRequest(t("invalidLangJsonbFormat"));
  }

  if (planData.benefits_jsonb && typeof planData.benefits_jsonb === 'string') {
    try {
      planData.benefits_jsonb = JSON.parse(planData.benefits_jsonb as string);
    } catch (e) {
      return apiResponse.badRequest(t("invalidJsonFormatInBenefitsString"));
    }
  } else if (planData.benefits_jsonb && typeof planData.benefits_jsonb !== 'object' && planData.benefits_jsonb !== null) {
    return apiResponse.badRequest(t("invalidBenefitsJsonFormat"));
  }

  try {
    delete planData.id;
    delete planData.created_at;
    delete planData.updated_at;

    const dataToUpdate: { [key: string]: any } = {
      ...planData
    };

    if (planData.features !== undefined) {
      dataToUpdate.features = planData.features as unknown as Json;
    }
    if (planData.lang_jsonb !== undefined) {
      dataToUpdate.lang_jsonb = planData.lang_jsonb as unknown as Json;
    }
    if (planData.benefits_jsonb !== undefined) {
      dataToUpdate.benefits_jsonb = planData.benefits_jsonb as unknown as Json;
    }

    const { data, error } = await supabase
      .from('pricing_plans')
      .update(dataToUpdate)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(`Error updating pricing plan ${id}:`, error);
      if (error.code === 'PGRST116') {
        return apiResponse.notFound(t("updatePlanNotFound", { id }));
      }
      return apiResponse.serverError(t("updatePlanServerError"));
    }

    if (!data) {
      return apiResponse.notFound(t("updatePlanNotFound", { id }));
    }

    return apiResponse.success(data);
  } catch (err) {
    console.error(`Unexpected error updating pricing plan ${id}:`, err);
    return apiResponse.serverError(t("updatePlanServerError"));
  }
}

// DELETE /api/admin/pricing-plans/{id} - Delete a plan by ID
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return apiResponse.unauthorized();
  }

  const supabase = await createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { get } = await headers();
  const locale = get("Accept-Language");

  const t = await getTranslations({ locale: locale || "en", namespace: 'Dashboard.Admin.Prices.API' });

  const { id } = await params;
  if (!id) {
    return apiResponse.badRequest(t("missingPlanId"));
  }

  try {
    const { error, count } = await supabase
      .from('pricing_plans')
      .delete({ count: 'exact' })
      .eq('id', id);

    if (error) {
      console.error(`Error deleting pricing plan ${id}:`, error);
      return apiResponse.serverError(t("deletePlanServerError"));
    }

    if (count === 0) {
      return apiResponse.notFound(t("deletePlanNotFound", { id }));
    }

    return apiResponse.success({ message: t("deletePlanSuccess", { id }) });
  } catch (err) {
    console.error(`Unexpected error deleting pricing plan ${id}:`, err);
    return apiResponse.serverError(t("deletePlanServerError"));
  }
} 