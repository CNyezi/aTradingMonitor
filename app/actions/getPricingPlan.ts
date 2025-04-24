import { createClient } from "@/lib/supabase/server";
import { Database } from "@/lib/supabase/types";
import { PricingPlan } from "@/types/pricing";
import {
  createClient as createAdminClient,
} from "@supabase/supabase-js";
import 'server-only';

export async function getAdminPricingPlans(): Promise<PricingPlan[]> {
  const supabaseAdmin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    let query = supabaseAdmin
      .from("pricing_plans")
      .select("*")
      .order("environment", { ascending: true })
      .order("display_order", { ascending: true });

    const { data: plans, error } = await query;

    if (error) {
      console.error("Error fetching pricing plans for admin page:", error);
      throw new Error(`Failed to fetch pricing plans: ${error.message}`);
    }

    return (plans as unknown as PricingPlan[]) || [];
  } catch (error) {
    console.error("Unexpected error in getAdminPricingPlans:", error);
    throw error;
  }
}

export async function getPublicPricingPlans(): Promise<PricingPlan[]> {

  const supabase = await createClient();
  const environment = process.env.NODE_ENV === 'production' ? 'live' : 'test';

  try {
    let query = supabase
      .from("pricing_plans")
      .select("*")
      .eq("environment", environment)
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    const { data: plans, error } = await query;

    if (error) {
      console.error("Error fetching pricing plans for admin page:", error);
      throw new Error(`Failed to fetch pricing plans: ${error.message}`);
    }

    return (plans as unknown as PricingPlan[]) || [];
  } catch (error) {
    console.error("Unexpected error in getPublicPricingPlans:", error);
    throw error;
  }
}


