'use server';

import { actionResponse } from '@/lib/action-response';
import { getErrorMessage } from '@/lib/error-utils';
import { createClient } from '@/lib/supabase/server';
import { Database } from '@/lib/supabase/types';

export type CreditLog = Database['public']['Tables']['credit_logs']['Row'];

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
    const from = pageIndex * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await supabase
      .from('credit_logs')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('Error fetching credit logs:', error);
      return actionResponse.error(`Failed to fetch credit logs: ${error.message}`);
    }

    return actionResponse.success({ logs: data || [], count: count ?? 0 });
  } catch (err: any) {
    console.error('Unexpected error fetching credit logs:', err);
    return actionResponse.error(getErrorMessage(err) || 'An unexpected server error occurred.');
  }
} 