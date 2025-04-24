CREATE TABLE public.subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    plan_id uuid NOT NULL REFERENCES public.pricing_plans(id) ON DELETE RESTRICT,
    stripe_subscription_id text NOT NULL UNIQUE,
    stripe_customer_id text NOT NULL,
    price_id text NOT NULL,
    status text NOT NULL,
    current_period_start timestamptz NULL,
    current_period_end timestamptz NULL,
    cancel_at_period_end boolean NOT NULL DEFAULT false,
    canceled_at timestamptz NULL,
    ended_at timestamptz NULL,
    trial_start timestamptz NULL,
    trial_end timestamptz NULL,
    metadata jsonb NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.subscriptions IS 'Stores the current state and details of user subscriptions, synced from Stripe.';
COMMENT ON COLUMN public.subscriptions.id IS 'Unique identifier for the subscription record in this table.';
COMMENT ON COLUMN public.subscriptions.user_id IS 'Foreign key referencing the user associated with this subscription.';
COMMENT ON COLUMN public.subscriptions.plan_id IS 'Foreign key referencing the internal pricing plan associated with this subscription.';
COMMENT ON COLUMN public.subscriptions.stripe_subscription_id IS 'The unique subscription ID from Stripe (sub_...). Used as the primary link to Stripe data.';
COMMENT ON COLUMN public.subscriptions.stripe_customer_id IS 'The Stripe customer ID (cus_...) associated with this subscription.';
COMMENT ON COLUMN public.subscriptions.price_id IS 'The specific Stripe Price ID (price_...) for the subscription item being tracked.';
COMMENT ON COLUMN public.subscriptions.status IS 'The current status of the subscription as reported by Stripe (e.g., active, trialing, past_due, canceled).';
COMMENT ON COLUMN public.subscriptions.current_period_start IS 'Timestamp marking the beginning of the current billing period.';
COMMENT ON COLUMN public.subscriptions.current_period_end IS 'Timestamp marking the end of the current billing period.';
COMMENT ON COLUMN public.subscriptions.cancel_at_period_end IS 'Indicates if the subscription is scheduled to cancel at the end of the current billing period.';
COMMENT ON COLUMN public.subscriptions.canceled_at IS 'Timestamp when the subscription was formally canceled in Stripe.';
COMMENT ON COLUMN public.subscriptions.ended_at IS 'Timestamp indicating when the subscription access definitively ended (e.g., after cancellation or failed payment grace period).';
COMMENT ON COLUMN public.subscriptions.trial_start IS 'Timestamp marking the beginning of the trial period, if applicable.';
COMMENT ON COLUMN public.subscriptions.trial_end IS 'Timestamp marking the end of the trial period, if applicable.';
COMMENT ON COLUMN public.subscriptions.metadata IS 'JSONB field to store additional context or metadata from Stripe or the application.';
COMMENT ON COLUMN public.subscriptions.created_at IS 'Timestamp indicating when this subscription record was first created in the database.';
COMMENT ON COLUMN public.subscriptions.updated_at IS 'Timestamp indicating when this subscription record was last updated.';

CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX idx_subscriptions_plan_id ON public.subscriptions(plan_id);
CREATE INDEX idx_subscriptions_stripe_customer_id ON public.subscriptions(stripe_customer_id);

CREATE TRIGGER handle_subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow user read own subscriptions"
ON public.subscriptions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Disallow user insert subscriptions"
ON public.subscriptions
FOR INSERT
WITH CHECK (false);

CREATE POLICY "Disallow user update subscriptions"
ON public.subscriptions
FOR UPDATE
USING (false);

CREATE POLICY "Disallow user delete subscriptions"
ON public.subscriptions
FOR DELETE
USING (false);