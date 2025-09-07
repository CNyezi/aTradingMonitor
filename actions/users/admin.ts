"use server";

import { db } from '@/db';
import { users } from '@/db/schema';
import { actionResponse } from '@/lib/action-response';
import { getErrorMessage } from '@/lib/error-utils';
import { isAdmin } from '@/lib/supabase/isAdmin';
import { UserType } from '@/types/admin/users';
import { count, desc, ilike, or } from 'drizzle-orm';

export interface GetUsersResult {
  success: boolean;
  data?: {
    users: UserType[];
    totalCount: number;
  };
  error?: string;
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
  if (!(await isAdmin())) {
    return actionResponse.forbidden('Admin privileges required.');
  }

  try {
    const conditions = [];
    if (filter) {
      conditions.push(
        or(
          ilike(users.email, `%${filter}%`),
          ilike(users.full_name, `%${filter}%`)
        )
      );
    }

    const usersQuery = db
      .select()
      .from(users)
      .where(conditions.length > 0 ? or(...conditions) : undefined)
      .orderBy(desc(users.created_at))
      .offset(pageIndex * pageSize)
      .limit(pageSize);

    const totalCountQuery = db
      .select({ value: count() })
      .from(users)
      .where(conditions.length > 0 ? or(...conditions) : undefined);

    const [results, totalCountResult] = await Promise.all([
      usersQuery,
      totalCountQuery,
    ]);

    const totalCount = totalCountResult[0].value;

    return actionResponse.success({
      users: results as unknown as UserType[] || [],
      totalCount: totalCount,
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return actionResponse.error(getErrorMessage(error));
  }
} 