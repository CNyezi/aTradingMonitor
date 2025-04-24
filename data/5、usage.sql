-- Create the 'usage' table to store user credits balances.
CREATE TABLE public.usage (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
    subscription_credits_balance integer NOT NULL DEFAULT 0 CHECK (subscription_credits_balance >= 0),
    one_time_credits_balance integer NOT NULL DEFAULT 0 CHECK (one_time_credits_balance >= 0),
    balance_jsonb jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.usage IS 'Stores usage data like credits balances for each user.';
COMMENT ON COLUMN public.usage.user_id IS 'Foreign key referencing the user associated with this usage record.';
COMMENT ON COLUMN public.usage.subscription_credits_balance IS 'Balance of credits granted via subscription, typically reset periodically upon successful payment.';
COMMENT ON COLUMN public.usage.one_time_credits_balance IS 'Balance of credits acquired through one-time purchases, accumulates over time.';
COMMENT ON COLUMN public.usage.balance_jsonb IS 'JSONB object to store additional balance information.';
COMMENT ON COLUMN public.usage.created_at IS 'Timestamp of when the user''s usage record was first created.';
COMMENT ON COLUMN public.usage.updated_at IS 'Timestamp of the last modification to the user''s usage record.';


CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_usage_updated
BEFORE UPDATE ON public.usage
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();


ALTER TABLE public.usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow user read own usage"
ON public.usage
FOR SELECT USING (auth.uid() = user_id);

-- Disallow users from inserting, updating, or deleting usage directly
  -- Optional, but recommended to keep
CREATE POLICY "Disallow user insert usage"
ON public.usage
FOR INSERT
WITH CHECK (false);

CREATE POLICY "Disallow user update usage"
ON public.usage
FOR UPDATE
USING (false);

CREATE POLICY "Disallow user delete usage"
ON public.usage
FOR DELETE
USING (false);

CREATE OR REPLACE FUNCTION public.upsert_and_increment_one_time_credits(p_user_id uuid, p_credits_to_add integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.usage (user_id, one_time_credits_balance, subscription_credits_balance)
    VALUES (p_user_id, p_credits_to_add, 0)
    ON CONFLICT (user_id)
    DO UPDATE SET
        one_time_credits_balance = usage.one_time_credits_balance + p_credits_to_add;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_and_increment_one_time_credits(uuid, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.upsert_and_set_subscription_credits(p_user_id uuid, p_credits_to_set integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.usage (user_id, subscription_credits_balance, one_time_credits_balance)
    VALUES (p_user_id, p_credits_to_set, 0)
    ON CONFLICT (user_id)
    DO UPDATE SET
        subscription_credits_balance = p_credits_to_set;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_and_set_subscription_credits(uuid, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.revoke_credits(
    p_user_id uuid,
    p_revoke_one_time integer,
    p_revoke_subscription integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_one_time_bal integer;
  v_current_sub_bal integer;
  v_new_one_time_bal integer;
  v_new_sub_bal integer;
BEGIN
  IF p_revoke_one_time < 0 OR p_revoke_subscription < 0 THEN
      RAISE WARNING 'Revoke amounts cannot be negative. User: %, One-Time: %, Subscription: %', p_user_id, p_revoke_one_time, p_revoke_subscription;
      RETURN false;
  END IF;

  IF p_revoke_one_time = 0 AND p_revoke_subscription = 0 THEN
      RETURN true;
  END IF;

  SELECT
      one_time_credits_balance,
      subscription_credits_balance
  INTO
      v_current_one_time_bal,
      v_current_sub_bal
  FROM public.usage
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
      RETURN true;
  END IF;

  v_new_one_time_bal := GREATEST(0, v_current_one_time_bal - p_revoke_one_time);
  v_new_sub_bal := GREATEST(0, v_current_sub_bal - p_revoke_subscription);

  IF v_new_one_time_bal <> v_current_one_time_bal OR v_new_sub_bal <> v_current_sub_bal THEN
      UPDATE public.usage
      SET
          one_time_credits_balance = v_new_one_time_bal,
          subscription_credits_balance = v_new_sub_bal
      WHERE user_id = p_user_id;
  END IF;

  RETURN true;

EXCEPTION
    WHEN others THEN
        RAISE WARNING 'Error in revoke_credits for user %: %', p_user_id, SQLERRM;
        RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.revoke_credits(uuid, integer, integer) TO service_role;
