-- =============================================
-- Update update_my_profile function to include referral field
-- =============================================

-- Drop the existing function first
DROP FUNCTION IF EXISTS public.update_my_profile(TEXT, TEXT);

-- Create a single function with optional referral parameter using DEFAULT
CREATE OR REPLACE FUNCTION public.update_my_profile(
    new_full_name TEXT,
    new_avatar_url TEXT,
    new_referral TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.users
  SET
    full_name = new_full_name,
    avatar_url = new_avatar_url,
    referral = CASE 
      WHEN new_referral IS NOT NULL THEN new_referral 
      ELSE referral 
    END
  WHERE id = auth.uid();
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.update_my_profile(TEXT, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.update_my_profile(TEXT, TEXT, TEXT) IS 'Updates user profile. The new_referral parameter is optional and will only update the referral field if provided (not NULL).';