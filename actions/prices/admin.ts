'use server'

import { db } from '@/db'
import { pricingPlans } from '@/db/schema'
import { DEFAULT_LOCALE } from '@/i18n/routing'
import { actionResponse, ActionResult } from '@/lib/action-response'
import { getErrorMessage } from '@/lib/error-utils'
import { isAdmin } from '@/lib/supabase/isAdmin'
import { Json } from '@/lib/supabase/types'
import { PricingPlan } from '@/types/pricing'
import { asc, eq } from 'drizzle-orm'
import { getTranslations } from 'next-intl/server'
import 'server-only'

/**
 * Admin List
 */
export async function getAdminPricingPlans(): Promise<
  ActionResult<PricingPlan[]>
> {
  if (!(await isAdmin())) {
    return actionResponse.forbidden('Admin privileges required.')
  }

  try {
    const plans = await db
      .select()
      .from(pricingPlans)
      .orderBy(asc(pricingPlans.environment), asc(pricingPlans.display_order))

    return actionResponse.success((plans as unknown as PricingPlan[]) || [])
  } catch (error) {
    console.error('Unexpected error in getAdminPricingPlans:', error)
    return actionResponse.error(getErrorMessage(error))
  }
}

/**
 * Admin Get By ID
 */
export async function getPricingPlanById(
  planId: string
): Promise<ActionResult<PricingPlan | null>> {
  if (!planId) {
    return actionResponse.badRequest('Plan ID is required.')
  }
  if (!(await isAdmin())) {
    return actionResponse.forbidden('Admin privileges required.')
  }

  try {
    const result = await db
      .select()
      .from(pricingPlans)
      .where(eq(pricingPlans.id, planId))
      .limit(1)

    const plan = result[0]

    if (!plan) {
      return actionResponse.notFound(`Pricing plan with ID ${planId} not found.`)
    }

    return actionResponse.success((plan as unknown as PricingPlan) || null)
  } catch (error) {
    console.error(
      `Unexpected error in getPricingPlanById for ID ${planId}:`,
      error
    )
    return actionResponse.error(getErrorMessage(error))
  }
}

/**
 * Admin Create
 */
interface CreatePricingPlanParams {
  planData: Partial<Omit<PricingPlan, 'id' | 'created_at' | 'updated_at'>>
  locale?: string
}

export async function createPricingPlanAction({
  planData,
  locale = DEFAULT_LOCALE,
}: CreatePricingPlanParams) {
  if (!(await isAdmin())) {
    return actionResponse.forbidden('Admin privileges required.')
  }

  const t = await getTranslations({
    locale,
    namespace: 'Prices.API',
  })

  if (!planData.environment || !planData.card_title) {
    return actionResponse.badRequest(t('missingRequiredFields'))
  }

  if (planData.lang_jsonb && typeof planData.lang_jsonb !== 'object') {
    try {
      if (typeof planData.lang_jsonb === 'string') {
        planData.lang_jsonb = JSON.parse(planData.lang_jsonb as string)
      } else {
        return actionResponse.badRequest(t('invalidLangJsonbFormat'))
      }
    } catch (e) {
      return actionResponse.badRequest(t('invalidJsonFormatInLangJsonbString'))
    }
  }

  if (planData.benefits_jsonb && typeof planData.benefits_jsonb !== 'object') {
    try {
      if (typeof planData.benefits_jsonb === 'string') {
        planData.benefits_jsonb = JSON.parse(planData.benefits_jsonb as string)
      } else {
        return actionResponse.badRequest(t('invalidBenefitsJsonFormat'))
      }
    } catch (e) {
      return actionResponse.badRequest(t('invalidJsonFormatInBenefitsString'))
    }
  }

  try {
    const [newPlan] = await db
      .insert(pricingPlans)
      .values({
        environment: planData.environment,
        card_title: planData.card_title,
        card_description: planData.card_description,
        stripe_price_id: planData.stripe_price_id,
        stripe_product_id: planData.stripe_product_id,
        stripe_coupon_id: planData.stripe_coupon_id,
        enable_manual_input_coupon:
          planData.enable_manual_input_coupon ?? false,
        payment_type: planData.payment_type,
        recurring_interval: planData.recurring_interval,
        price: planData.price?.toString(),
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
      .returning()

    return actionResponse.success(newPlan)
  } catch (err) {
    console.error('Unexpected error creating pricing plan:', err)
    const errorMessage = getErrorMessage(err)
    if (errorMessage.includes('duplicate key value violates unique constraint')) {
      return actionResponse.conflict(
        t('createPlanConflict', { message: errorMessage })
      )
    }
    return actionResponse.error(errorMessage || t('createPlanServerError'))
  }
}

/**
 * Admin Update
 */
interface UpdatePricingPlanParams {
  id: string
  planData: Partial<PricingPlan>
  locale?: string
}
export async function updatePricingPlanAction({
  id,
  planData,
  locale = DEFAULT_LOCALE,
}: UpdatePricingPlanParams) {
  if (!(await isAdmin())) {
    return actionResponse.forbidden('Admin privileges required.')
  }

  const t = await getTranslations({
    locale,
    namespace: 'Prices.API',
  })

  if (!id) {
    return actionResponse.badRequest(t('missingPlanId'))
  }

  if (planData.lang_jsonb && typeof planData.lang_jsonb === 'string') {
    try {
      planData.lang_jsonb = JSON.parse(planData.lang_jsonb as string)
    } catch (e) {
      return actionResponse.badRequest(t('invalidJsonFormatInLangJsonbString'))
    }
  } else if (
    planData.lang_jsonb &&
    typeof planData.lang_jsonb !== 'object' &&
    planData.lang_jsonb !== null
  ) {
    return actionResponse.badRequest(t('invalidLangJsonbFormat'))
  }

  if (planData.benefits_jsonb && typeof planData.benefits_jsonb === 'string') {
    try {
      planData.benefits_jsonb = JSON.parse(planData.benefits_jsonb as string)
    } catch (e) {
      return actionResponse.badRequest(t('invalidJsonFormatInBenefitsString'))
    }
  } else if (
    planData.benefits_jsonb &&
    typeof planData.benefits_jsonb !== 'object' &&
    planData.benefits_jsonb !== null
  ) {
    return actionResponse.badRequest(t('invalidBenefitsJsonFormat'))
  }

  try {
    delete planData.id
    delete planData.created_at
    delete planData.updated_at

    const dataToUpdate: { [key: string]: any } = { ...planData }

    if (dataToUpdate.price) {
      dataToUpdate.price = dataToUpdate.price.toString()
    }

    if (planData.features !== undefined) {
      dataToUpdate.features = (planData.features || []) as unknown as Json
    }
    if (planData.lang_jsonb !== undefined) {
      dataToUpdate.lang_jsonb = (planData.lang_jsonb || {}) as unknown as Json
    }
    if (planData.benefits_jsonb !== undefined) {
      dataToUpdate.benefits_jsonb =
        (planData.benefits_jsonb || {}) as unknown as Json
    }

    const [updatedPlan] = await db
      .update(pricingPlans)
      .set(dataToUpdate)
      .where(eq(pricingPlans.id, id))
      .returning()

    if (!updatedPlan) {
      return actionResponse.notFound(t('updatePlanNotFound', { id }))
    }


    return actionResponse.success(updatedPlan)
  } catch (err) {
    console.error(`Unexpected error updating pricing plan ${id}:`, err)
    return actionResponse.error(
      getErrorMessage(err) || t('updatePlanServerError')
    )
  }
}

/**
 * Admin Delete
 */
interface DeletePricingPlanParams {
  id: string
  locale?: string
}

export async function deletePricingPlanAction({
  id,
  locale = DEFAULT_LOCALE,
}: DeletePricingPlanParams) {
  if (!(await isAdmin())) {
    return actionResponse.forbidden('Admin privileges required.')
  }

  const t = await getTranslations({
    locale,
    namespace: 'Prices.API',
  })

  if (!id) {
    return actionResponse.badRequest(t('missingPlanId'))
  }

  try {
    const result = await db
      .delete(pricingPlans)
      .where(eq(pricingPlans.id, id))
      .returning({ id: pricingPlans.id })

    if (result.length === 0) {
      return actionResponse.notFound(t('deletePlanNotFound', { id }))
    }


    return actionResponse.success({ message: t('deletePlanSuccess', { id }) })
  } catch (err) {
    console.error(`Unexpected error deleting pricing plan ${id}:`, err)
    return actionResponse.error(
      getErrorMessage(err) || t('deletePlanServerError')
    )
  }
}

