-- Create the public.orders table
CREATE TABLE public.orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    provider text NOT NULL,
    provider_order_id text NOT NULL,
    status text NOT NULL,
    order_type text NOT NULL,
    product_id text NULL,
    plan_id uuid NULL REFERENCES public.pricing_plans(id) ON DELETE SET NULL,
    price_id text NULL,
    amount_subtotal numeric NULL,
    amount_discount numeric NULL DEFAULT 0,
    amount_tax numeric NULL DEFAULT 0,
    amount_total numeric NOT NULL,
    currency text NOT NULL,
    subscription_provider_id text NULL,
    period_start timestamptz NULL,
    period_end timestamptz NULL,
    metadata jsonb NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.orders IS 'Stores all payment transactions and subscription lifecycle events.';
COMMENT ON COLUMN public.orders.id IS 'Unique order/record ID.';
COMMENT ON COLUMN public.orders.user_id IS 'Associated user ID from public.users.';
COMMENT ON COLUMN public.orders.provider IS 'Payment provider identifier (e.g., ''stripe'').';
COMMENT ON COLUMN public.orders.provider_order_id IS 'Provider''s unique ID for the transaction/subscription (e.g., pi_..., sub_..., cs_..., in_...).';
COMMENT ON COLUMN public.orders.status IS 'Order/subscription status (e.g., ''pending'', ''succeeded'', ''failed'', ''active'', ''canceled'', ''refunded'', ''past_due'', ''incomplete'').';
COMMENT ON COLUMN public.orders.order_type IS 'Type of order (e.g., ''one_time_purchase'', ''subscription_initial'', ''subscription_renewal'', ''refund'').';
COMMENT ON COLUMN public.orders.product_id IS 'Provider''s product ID.';
COMMENT ON COLUMN public.orders.plan_id IS 'Associated internal plan ID from public.pricing_plans.';
COMMENT ON COLUMN public.orders.price_id IS 'Provider''s price ID (e.g., price_...).';
COMMENT ON COLUMN public.orders.amount_subtotal IS 'Amount before discounts.';
COMMENT ON COLUMN public.orders.amount_discount IS 'Discount amount.';
COMMENT ON COLUMN public.orders.amount_tax IS 'Tax amount.';
COMMENT ON COLUMN public.orders.amount_total IS 'Final amount paid/due.';
COMMENT ON COLUMN public.orders.currency IS 'Currency code (e.g., ''usd'').';
COMMENT ON COLUMN public.orders.subscription_provider_id IS 'Associated Stripe subscription ID (sub_...) for subscription-related events.';
COMMENT ON COLUMN public.orders.period_start IS 'Start time of the subscription billing period.';
COMMENT ON COLUMN public.orders.period_end IS 'End time of the subscription billing period.';
COMMENT ON COLUMN public.orders.metadata IS 'Stores additional information (e.g., Checkout Session metadata, refund reasons, coupon codes).';
COMMENT ON COLUMN public.orders.created_at IS 'Timestamp of record creation.';
COMMENT ON COLUMN public.orders.updated_at IS 'Timestamp of last record update.';


-- Create indexes on the public.orders table
CREATE INDEX idx_orders_user_id ON public.orders(user_id);
CREATE INDEX idx_orders_provider ON public.orders(provider);
CREATE INDEX idx_orders_subscription_provider_id ON public.orders(subscription_provider_id);
CREATE INDEX idx_orders_plan_id ON public.orders(plan_id);
CREATE UNIQUE INDEX idx_orders_provider_provider_order_id_unique ON public.orders(provider, provider_order_id);
CREATE UNIQUE INDEX IF NOT EXISTS unique_initial_subscription_record
ON public.orders (provider, subscription_provider_id)
WHERE order_type = 'subscription_initial';


-- Add the updated_at function & trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER handle_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();


-- Set up Row Level Security (RLS) for public.orders

-- Enable RLS on the table
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own orders
CREATE POLICY "Allow user read own orders"
ON public.orders
FOR SELECT
USING (auth.uid() = user_id);

-- Disallow users from inserting, updating, or deleting orders directly
  -- Optional, but recommended to keep
CREATE POLICY "Disallow user insert orders"
ON public.orders
FOR INSERT
WITH CHECK (false);

CREATE POLICY "Disallow user update orders"
ON public.orders
FOR UPDATE
USING (false);

CREATE POLICY "Disallow user delete orders"
ON public.orders
FOR DELETE
USING (false);