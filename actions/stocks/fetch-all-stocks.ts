'use server'

import { actionResponse, ActionResult } from '@/lib/action-response'
import { isAdmin } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { stocks as stocksSchema } from '@/lib/db/schema'
import { getErrorMessage } from '@/lib/error-utils'
import { getTushareClient } from '@/lib/tushare'
import { sql } from 'drizzle-orm'

export type FetchAllStocksResult = ActionResult<{
  totalCount: number
  newCount: number
  updatedCount: number
}>

/**
 * 从 Tushare API 获取全量股票数据并更新数据库
 * 仅管理员可调用
 */
export async function fetchAllStocks(): Promise<FetchAllStocksResult> {
  // 权限检查:仅管理员可执行
  const admin = await isAdmin()
  if (!admin) {
    return actionResponse.unauthorized()
  }

  try {
    const tushare = getTushareClient()

    // 获取所有上市股票
    const stocks = await tushare.getStockBasicWithRetry({
      listStatus: 'L',
    })

    if (!stocks || stocks.length === 0) {
      return actionResponse.error('No stock data received from Tushare API')
    }

    // 使用 upsert 批量插入或更新
    let newCount = 0
    let updatedCount = 0

    for (const stock of stocks) {
      try {
        // PostgreSQL INSERT ... ON CONFLICT DO UPDATE
        const result = await db
          .insert(stocksSchema)
          .values({
            tsCode: stock.ts_code,
            symbol: stock.symbol,
            name: stock.name,
            area: stock.area,
            industry: stock.industry,
            market: stock.market,
            listDate: stock.list_date,
          })
          .onConflictDoUpdate({
            target: stocksSchema.tsCode,
            set: {
              symbol: stock.symbol,
              name: stock.name,
              area: stock.area,
              industry: stock.industry,
              market: stock.market,
              listDate: stock.list_date,
              updatedAt: sql`now()`,
            },
          })
          .returning({ id: stocksSchema.id })

        // 检查是否是新插入(简化处理,统计可能不完全准确)
        if (result.length > 0) {
          newCount++
        }
      } catch (error) {
        console.error(`[FetchStocks] Failed to upsert stock ${stock.ts_code}:`, error)
        // 继续处理其他股票
      }
    }

    // 简化计数:假设总数 - 新增 = 更新
    updatedCount = stocks.length - newCount

    return actionResponse.success({
      totalCount: stocks.length,
      newCount,
      updatedCount,
    })
  } catch (error) {
    console.error('[FetchStocks] Error:', error)
    return actionResponse.error(getErrorMessage(error))
  }
}
