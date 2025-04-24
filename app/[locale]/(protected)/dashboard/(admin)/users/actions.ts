"use server";

import { isAdmin } from '@/lib/supabase/isAdmin';
import { Database } from '@/lib/supabase/types';
import { UserType } from "@/types/admin/users";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export interface GetUsersResult {
  users: UserType[];
  totalCount: number;
}

const DEFAULT_PAGE_SIZE = 20;

export async function getUsers({
  pageIndex = 0,
  pageSize = DEFAULT_PAGE_SIZE,
  filter = "",
}: {
  pageIndex?: number;
  pageSize?: number;
  filter?: string;
}): Promise<GetUsersResult> {

  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    console.error(`not admin user`);
    throw new Error("Permission denied: you are not an admin user");
  }

  const supabaseAdmin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const from = pageIndex * pageSize;
  const to = from + pageSize - 1;

  let query = supabaseAdmin
    .from("users")
    .select("*", { count: 'exact' });

  if (filter) {
    const filterValue = `%${filter}%`;
    query = query.or(
      `email.ilike.${filterValue},full_name.ilike.${filterValue}`
    );
  }

  query = query.range(from, to).order("created_at", { ascending: false });

  const { data: users, error, count } = await query;

  if (error) {
    console.error("Error fetching users:", error);
    throw new Error(`Failed to fetch users: ${error.message}`);
  }

  return {
    users: users || [],
    totalCount: count || 0,
  };
} 