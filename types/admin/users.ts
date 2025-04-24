import { Database } from "@/lib/supabase/types";

export type UserType = Database["public"]["Tables"]["users"]["Row"];