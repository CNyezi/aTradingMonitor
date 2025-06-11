
export interface PricingPlanFeature {
  description: string;
  included: boolean;
}

export interface PricingPlanTranslation {
  card_title?: string;
  card_description?: string;
  display_price?: string;
  original_price?: string;
  price_suffix?: string;
  features?: PricingPlanFeature[];
  highlight_text?: string;
  button_text?: string;
}

export interface PricingPlan {
  id: string;
  created_at: string;
  updated_at: string;
  environment: 'test' | 'live';
  card_title: string;
  card_description?: string | null;
  stripe_price_id?: string | null;
  stripe_product_id?: string | null;
  stripe_coupon_id?: string | null;
  enable_manual_input_coupon?: boolean;
  payment_type?: 'one_time' | 'recurring' | string | null;
  recurring_interval?: 'month' | 'year' | 'week' | string | null;
  price?: number | null;
  currency?: string | null;
  display_price?: string | null;
  original_price?: string | null;
  price_suffix?: string | null;
  features: PricingPlanFeature[] | null;
  is_highlighted: boolean;
  highlight_text?: string | null;
  button_text?: string | null;
  button_link?: string | null;
  display_order: number;
  is_active: boolean;
  lang_jsonb?: { [lang_code: string]: PricingPlanTranslation } | null;
  benefits_jsonb?: { [key: string]: any } | null;
} 
