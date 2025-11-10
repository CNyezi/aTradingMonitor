'use server'

import { actionResponse, ActionResult } from '@/lib/action-response'
import { getSession } from '@/lib/auth/server'
import { db } from '@/lib/db'
import {
  userWatchedStocks as watchedStocksSchema,
  stocks as stocksSchema,
  userStockGroups as groupsSchema,
} from '@/lib/db/schema'
import { getErrorMessage } from '@/lib/error-utils'
import { eq, and, desc, isNull } from 'drizzle-orm'
import { z } from 'zod'
import type { StockWithGroup } from '@/lib/tushare'

const GetWatchedStocksSchema = z.object({
  groupId: z.string().uuid().nullable().optional(),
})

export type GetWatchedStocksResult = ActionResult<{
  stocks: StockWithGroup[]
}>

/**
 * 获取用户关注的股票列表
 * @param groupId - 可选,指定分组ID获取该分组下的股票,null获取未分组股票,undefined获取所有
 */
export async function getWatchedStocks(
  params?: z.infer<typeof GetWatchedStocksSchema>
): Promise<GetWatchedStocksResult> {
  const session = await getSession()
  const user = session?.user
  if (!user) {
    return actionResponse.unauthorized()
  }

  try {
    const { groupId } = GetWatchedStocksSchema.parse(params || {})

    // 构建查询条件
    let whereCondition
    if (groupId === undefined) {
      // 获取所有关注的股票
      whereCondition = eq(watchedStocksSchema.userId, user.id)
    } else if (groupId === null) {
      // 获取未分组的股票
      whereCondition = and(
        eq(watchedStocksSchema.userId, user.id),
        isNull(watchedStocksSchema.groupId)
      )
    } else {
      // 获取指定分组的股票
      whereCondition = and(
        eq(watchedStocksSchema.userId, user.id),
        eq(watchedStocksSchema.groupId, groupId)
      )
    }

    // 联表查询:watched_stocks + stocks + groups
    const results = await db
      .select({
        id: stocksSchema.id,
        tsCode: stocksSchema.tsCode,
        symbol: stocksSchema.symbol,
        name: stocksSchema.name,
        area: stocksSchema.area,
        industry: stocksSchema.industry,
        market: stocksSchema.market,
        listDate: stocksSchema.listDate,
        groupId: watchedStocksSchema.groupId,
        groupName: groupsSchema.name,
        addedAt: watchedStocksSchema.addedAt,
      })
      .from(watchedStocksSchema)
      .innerJoin(stocksSchema, eq(watchedStocksSchema.stockId, stocksSchema.id))
      .leftJoin(groupsSchema, eq(watchedStocksSchema.groupId, groupsSchema.id))
      .where(whereCondition)
      .orderBy(desc(watchedStocksSchema.addedAt))
      .execute()

    return actionResponse.success({ stocks: results })
  } catch (error) {
    console.error('[GetWatchedStocks] Error:', error)
    return actionResponse.error(getErrorMessage(error))
  }
}
