'use server'

import { actionResponse, ActionResult } from '@/lib/action-response'
import { getSession } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { stocks as stocksSchema } from '@/lib/db/schema'
import { getErrorMessage } from '@/lib/error-utils'
import { or, ilike, sql } from 'drizzle-orm'
import { z } from 'zod'

const SearchSchema = z.object({
  keyword: z.string().min(1, 'Keyword is required'),
  limit: z.number().min(1).max(50).default(20),
})

export type SearchStocksResult = ActionResult<{
  stocks: Array<typeof stocksSchema.$inferSelect>
}>

/**
 * 搜索股票
 * 支持按股票代码(ts_code/symbol)或名称搜索
 */
export async function searchStocks(
  params: z.infer<typeof SearchSchema>
): Promise<SearchStocksResult> {
  // 认证检查
  const session = await getSession()
  const user = session?.user
  if (!user) {
    return actionResponse.unauthorized()
  }

  try {
    const { keyword, limit } = SearchSchema.parse(params)

    // 模糊搜索:股票代码或名称
    const results = await db
      .select()
      .from(stocksSchema)
      .where(
        or(
          ilike(stocksSchema.tsCode, `%${keyword}%`),
          ilike(stocksSchema.symbol, `%${keyword}%`),
          ilike(stocksSchema.name, `%${keyword}%`)
        )
      )
      .limit(limit)
      .execute()

    return actionResponse.success({ stocks: results })
  } catch (error) {
    console.error('[SearchStocks] Error:', error)
    return actionResponse.error(getErrorMessage(error))
  }
}
