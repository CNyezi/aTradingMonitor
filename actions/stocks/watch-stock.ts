'use server'

import { actionResponse, ActionResult } from '@/lib/action-response'
import { getSession } from '@/lib/auth/server'
import { db } from '@/lib/db'
import {
  userWatchedStocks as watchedStocksSchema,
  stocks as stocksSchema,
} from '@/lib/db/schema'
import { getErrorMessage } from '@/lib/error-utils'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

const WatchStockSchema = z.object({
  stockId: z.string().uuid(),
  groupId: z.string().uuid().nullable().optional(),
})

const UnwatchStockSchema = z.object({
  stockId: z.string().uuid(), // watchedStock ID (userWatchedStocks.id)
})

export type WatchStockResult = ActionResult<{
  watchedStock: typeof watchedStocksSchema.$inferSelect
}>

export type UnwatchStockResult = ActionResult<{
  success: boolean
}>

/**
 * 添加股票到用户关注列表
 */
export async function watchStock(
  params: z.infer<typeof WatchStockSchema>
): Promise<WatchStockResult> {
  const session = await getSession()
  const user = session?.user
  if (!user) {
    return actionResponse.unauthorized()
  }

  try {
    const { stockId, groupId } = WatchStockSchema.parse(params)

    // 检查股票是否存在
    const stock = await db
      .select()
      .from(stocksSchema)
      .where(eq(stocksSchema.id, stockId))
      .limit(1)
      .execute()

    if (!stock || stock.length === 0) {
      return actionResponse.error('Stock not found')
    }

    // 检查是否已关注
    const existing = await db
      .select()
      .from(watchedStocksSchema)
      .where(
        and(
          eq(watchedStocksSchema.userId, user.id),
          eq(watchedStocksSchema.stockId, stockId)
        )
      )
      .limit(1)
      .execute()

    if (existing && existing.length > 0) {
      return actionResponse.error('Stock already watched')
    }

    // 添加关注
    const result = await db
      .insert(watchedStocksSchema)
      .values({
        userId: user.id,
        stockId,
        groupId: groupId || null,
      })
      .returning()
      .execute()

    return actionResponse.success({ watchedStock: result[0] })
  } catch (error) {
    console.error('[WatchStock] Error:', error)
    return actionResponse.error(getErrorMessage(error))
  }
}

/**
 * 取消关注股票
 */
export async function unwatchStock(
  params: z.infer<typeof UnwatchStockSchema>
): Promise<UnwatchStockResult> {
  const session = await getSession()
  const user = session?.user
  if (!user) {
    return actionResponse.unauthorized()
  }

  try {
    const { stockId } = UnwatchStockSchema.parse(params)

    // stockId 是 userWatchedStocks.id
    await db
      .delete(watchedStocksSchema)
      .where(
        and(
          eq(watchedStocksSchema.userId, user.id),
          eq(watchedStocksSchema.id, stockId)
        )
      )
      .execute()

    return actionResponse.success({ success: true })
  } catch (error) {
    console.error('[UnwatchStock] Error:', error)
    return actionResponse.error(getErrorMessage(error))
  }
}
