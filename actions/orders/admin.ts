'use server';

import { db } from '@/db';
import { orders as ordersSchema, users as usersSchema } from '@/db/schema';
import { ActionResult, actionResponse } from '@/lib/action-response';
import { getErrorMessage } from '@/lib/error-utils';
import { isAdmin } from '@/lib/supabase/isAdmin';
import { OrderWithUser } from '@/types/admin/orders';
import { and, count, desc, eq, ilike, or } from 'drizzle-orm';
import { z } from 'zod';

const FilterSchema = z.object({
  pageIndex: z.coerce.number().default(0),
  pageSize: z.coerce.number().default(10),
  filter: z.string().optional(),
  provider: z.string().optional(),
  order_type: z.string().optional(),
  status: z.string().optional(),
});

export type GetOrdersResult = ActionResult<{
  orders: OrderWithUser[];
  totalCount: number;
}>;

export async function getOrders(
  params: z.infer<typeof FilterSchema>
): Promise<GetOrdersResult> {
  if (!(await isAdmin())) {
    return actionResponse.forbidden('Admin privileges required.');
  }
  try {
    const { pageIndex, pageSize, filter, provider, order_type, status } =
      FilterSchema.parse(params);

    const conditions = [];
    if (provider) {
      conditions.push(eq(ordersSchema.provider, provider));
    }
    if (order_type) {
      conditions.push(eq(ordersSchema.order_type, order_type));
    }
    if (status) {
      conditions.push(eq(ordersSchema.status, status));
    }
    if (filter) {
      conditions.push(
        or(
          ilike(usersSchema.email, `%${filter}%`),
          ilike(ordersSchema.provider_order_id, `%${filter}%`)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const ordersQuery = db
      .select({
        order: ordersSchema,
        user: { email: usersSchema.email, full_name: usersSchema.full_name },
      })
      .from(ordersSchema)
      .leftJoin(usersSchema, eq(ordersSchema.user_id, usersSchema.id))
      .where(whereClause)
      .orderBy(desc(ordersSchema.created_at))
      .offset(pageIndex * pageSize)
      .limit(pageSize);

    const totalCountQuery = db
      .select({ value: count() })
      .from(ordersSchema)
      .leftJoin(usersSchema, eq(ordersSchema.user_id, usersSchema.id))
      .where(whereClause);

    const [results, totalCountResult] = await Promise.all([
      ordersQuery,
      totalCountQuery,
    ]);

    const totalCount = totalCountResult[0].value;

    const ordersData = results.map((r) => ({
      ...r.order,
      users: r.user,
    }));

    return actionResponse.success({
      orders: ordersData as unknown as OrderWithUser[],
      totalCount: totalCount,
    });
  } catch (error) {
    console.error('Error getting orders', error);
    return actionResponse.error(getErrorMessage(error));
  }
} 