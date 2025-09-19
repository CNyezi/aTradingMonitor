
export interface PricingPlanFeature {
  description: string;
  included: boolean;
  bold?: boolean;
}

export interface PricingPlanTranslation {
  cardTitle?: string;
  cardDescription?: string;
  displayPrice?: string;
  originalPrice?: string;
  priceSuffix?: string;
  features?: PricingPlanFeature[];
  highlightText?: string;
  buttonText?: string;
}

export interface PricingPlanLangJsonb {
  [locale: string]: PricingPlanTranslation;
}

export interface PricingPlan {
  id: string;
  createdAt: string;
  updatedAt: string;
  environment: 'test' | 'live';
  cardTitle: string;
  cardDescription?: string | null;
  stripePriceId?: string | null;
  stripeProductId?: string | null;
  stripeCouponId?: string | null;
  enableManualInputCoupon?: boolean;
  paymentType?: 'one_time' | 'recurring' | string | null;
  recurringInterval?: 'month' | 'year' | 'week' | string | null;
  price?: number | null;
  currency?: string | null;
  displayPrice?: string | null;
  originalPrice?: string | null;
  priceSuffix?: string | null;
  features: PricingPlanFeature[] | null;
  isHighlighted: boolean;
  highlightText?: string | null;
  buttonText?: string | null;
  buttonLink?: string | null;
  displayOrder: number;
  isActive: boolean;
  langJsonb?: PricingPlanLangJsonb | null;
  benefitsJsonb?: { [key: string]: any } | null;
} 
