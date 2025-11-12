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
  costPrice: z.string().optional(), // 使用 string 传输避免精度问题
  quantity: z.number().int().positive().optional(), // 必须是正整数
})

const UnwatchStockSchema = z.object({
  stockId: z.string().uuid(), // watchedStock ID (userWatchedStocks.id)
})

const UpdatePositionSchema = z.object({
  watchedStockId: z.string().uuid(),
  costPrice: z.string().nullable().optional(), // 使用 string 传输避免精度问题
  quantity: z.number().int().nullable().optional(), // 可以为 null 表示清空
}).refine(
  (data) => {
    // 如果设置了持仓，costPrice 和 quantity 必须都有值且为正数
    if (data.costPrice !== null && data.costPrice !== undefined) {
      if (data.quantity === null || data.quantity === undefined) {
        return false
      }
      const price = parseFloat(data.costPrice)
      return price > 0 && data.quantity > 0
    }
    if (data.quantity !== null && data.quantity !== undefined) {
      if (data.costPrice === null || data.costPrice === undefined) {
        return false
      }
      const price = parseFloat(data.costPrice)
      return price > 0 && data.quantity > 0
    }
    return true
  },
  {
    message: 'Cost price and quantity must both be set with positive values, or both be null',
  }
)

export type WatchStockResult = ActionResult<{
  watchedStock: typeof watchedStocksSchema.$inferSelect
}>

export type UnwatchStockResult = ActionResult<{
  success: boolean
}>

export type UpdatePositionResult = ActionResult<{
  watchedStock: typeof watchedStocksSchema.$inferSelect
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
    const { stockId, groupId, costPrice, quantity } = WatchStockSchema.parse(params)

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
        costPrice: costPrice || null,
        quantity: quantity || null,
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

/**
 * 更新股票持仓信息
 */
export async function updateStockPosition(
  params: z.infer<typeof UpdatePositionSchema>
): Promise<UpdatePositionResult> {
  const session = await getSession()
  const user = session?.user
  if (!user) {
    return actionResponse.unauthorized()
  }

  try {
    const { watchedStockId, costPrice, quantity } = UpdatePositionSchema.parse(params)

    // 检查股票是否属于当前用户
    const existing = await db
      .select()
      .from(watchedStocksSchema)
      .where(
        and(
          eq(watchedStocksSchema.userId, user.id),
          eq(watchedStocksSchema.id, watchedStockId)
        )
      )
      .limit(1)
      .execute()

    if (!existing || existing.length === 0) {
      return actionResponse.error('Watched stock not found')
    }

    // 更新持仓信息
    const result = await db
      .update(watchedStocksSchema)
      .set({
        costPrice: costPrice || null,
        quantity: quantity || null,
      })
      .where(
        and(
          eq(watchedStocksSchema.userId, user.id),
          eq(watchedStocksSchema.id, watchedStockId)
        )
      )
      .returning()
      .execute()

    return actionResponse.success({ watchedStock: result[0] })
  } catch (error) {
    console.error('[UpdateStockPosition] Error:', error)
    return actionResponse.error(getErrorMessage(error))
  }
}
