"use server";

import { db } from '@/drizzle/db';
import { user as userSchema } from '@/drizzle/db/schema';
import { actionResponse } from '@/lib/action-response';
import { isAdmin } from '@/lib/auth/server';
import { getErrorMessage } from '@/lib/error-utils';
import { count, desc, ilike, or } from 'drizzle-orm';

type UserType = typeof userSchema.$inferSelect;

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
          ilike(userSchema.email, `%${filter}%`),
          ilike(userSchema.name, `%${filter}%`)
        )
      );
    }

    const usersQuery = db
      .select()
      .from(userSchema)
      .where(conditions.length > 0 ? or(...conditions) : undefined)
      .orderBy(desc(userSchema.createdAt))
      .offset(pageIndex * pageSize)
      .limit(pageSize);

    const totalCountQuery = db
      .select({ value: count() })
      .from(userSchema)
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