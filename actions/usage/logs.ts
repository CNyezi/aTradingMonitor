'use server';

import { db } from '@/db';
import { creditLogs } from '@/db/schema';
import { actionResponse } from '@/lib/action-response';
import { getErrorMessage } from '@/lib/error-utils';
import { createClient } from '@/lib/supabase/server';
import { count, desc, eq } from 'drizzle-orm';

export type CreditLog = typeof creditLogs.$inferSelect;

interface ListCreditLogsParams {
  pageIndex?: number;
  pageSize?: number;
}

interface ListCreditLogsResult {
  success: boolean;
  data?: {
    logs: CreditLog[];
    count: number;
  };
  error?: string;
}

/**
 * Fetches the credit usage history for the currently authenticated user with pagination.
 * @returns An ActionResult containing an array of credit logs, the total count, or an error.
 */
export async function getCreditLogs({
  pageIndex = 0,
  pageSize = 20,
}: ListCreditLogsParams = {}): Promise<ListCreditLogsResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return actionResponse.unauthorized();
  }

  try {
    const whereClause = eq(creditLogs.user_id, user.id);

    const logsQuery = db
      .select()
      .from(creditLogs)
      .where(whereClause)
      .orderBy(desc(creditLogs.created_at))
      .offset(pageIndex * pageSize)
      .limit(pageSize);

    const totalCountQuery = db
      .select({ value: count() })
      .from(creditLogs)
      .where(whereClause);

    const [data, totalCountResult] = await Promise.all([
      logsQuery,
      totalCountQuery,
    ]);
    const totalCount = totalCountResult[0].value;

    return actionResponse.success({ logs: data || [], count: totalCount ?? 0 });
  } catch (err: any) {
    console.error('Unexpected error fetching credit logs:', err);
    return actionResponse.error(
      getErrorMessage(err) || 'An unexpected server error occurred.'
    );
  }
} 