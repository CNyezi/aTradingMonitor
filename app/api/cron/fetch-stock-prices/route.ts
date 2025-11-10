/**
 * 股票价格采集 Cron Job
 * 频率: 每1分钟
 * 权限: Vercel Cron Secret 验证
 *
 * 功能:
 * 1. 获取所有被监控的股票列表 (有启用的监控规则的股票)
 * 2. 调用 Tushare stk_mins 接口获取最新1分钟行情
 * 3. 保存到 stock_price_snapshots 表
 * 4. 缓存到 Redis (7天过期)
 */

import { db } from '@/lib/db'
import { userWatchedStocks, stockPriceSnapshots, stocks } from '@/lib/db/schema'
import { getTushareClient } from '@/lib/tushare/client'
import { eq, and, inArray } from 'drizzle-orm'
import { NextResponse } from 'next/server'

// Vercel Cron Secret 验证
function verifyCronSecret(request: Request): boolean {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.warn('[Cron] CRON_SECRET not configured')
    return false
  }

  if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[Cron] Invalid authorization header')
    return false
  }

  return true
}

/**
 * 检查是否在交易时间内
 * 交易时间: 周一至周五 09:30-11:30, 13:00-15:00
 */
function isWithinTradingHours(): boolean {
  const now = new Date()
  const day = now.getDay() // 0=周日, 1-5=周一到周五, 6=周六

  // 周末不交易
  if (day === 0 || day === 6) {
    return false
  }

  // 转换为北京时间 (UTC+8)
  const bjTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }))
  const hours = bjTime.getHours()
  const minutes = bjTime.getMinutes()
  const timeInMinutes = hours * 60 + minutes

  // 上午: 09:30-11:30 (570-690分钟)
  const morningStart = 9 * 60 + 30 // 570
  const morningEnd = 11 * 60 + 30 // 690

  // 下午: 13:00-15:00 (780-900分钟)
  const afternoonStart = 13 * 60 // 780
  const afternoonEnd = 15 * 60 // 900

  return (
    (timeInMinutes >= morningStart && timeInMinutes <= morningEnd) ||
    (timeInMinutes >= afternoonStart && timeInMinutes <= afternoonEnd)
  )
}

export async function GET(request: Request) {
  try {
    // 1. 验证 Cron Secret
    if (!verifyCronSecret(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. 检查是否在交易时间内
    if (!isWithinTradingHours()) {
      console.log('[Cron] Not within trading hours, skipping...')
      return NextResponse.json({
        success: true,
        message: 'Not within trading hours',
        skipped: true,
      })
    }

    console.log('[Cron] Starting stock price collection...')

    // 3. 获取所有开启监控的股票（monitored=true）
    const monitoredStocks = await db
      .selectDistinct({
        stockId: userWatchedStocks.stockId,
        tsCode: stocks.tsCode,
      })
      .from(userWatchedStocks)
      .innerJoin(stocks, eq(userWatchedStocks.stockId, stocks.id))
      .where(eq(userWatchedStocks.monitored, true))

    if (monitoredStocks.length === 0) {
      console.log('[Cron] No monitored stocks found')
      return NextResponse.json({
        success: true,
        message: 'No monitored stocks',
        collected: 0,
      })
    }

    console.log(`[Cron] Found ${monitoredStocks.length} monitored stocks`)

    // 4. 批量获取最新分钟行情
    const tushare = getTushareClient()
    const tsCodes = monitoredStocks.map((s) => s.tsCode)
    const latestPrices = await tushare.getBatchLatestMinutes(tsCodes, '1min')

    // 5. 保存到数据库
    let savedCount = 0
    const now = new Date()

    for (const stock of monitoredStocks) {
      const priceData = latestPrices.get(stock.tsCode)

      if (!priceData) {
        console.warn(`[Cron] No price data for ${stock.tsCode}`)
        continue
      }

      try {
        await db.insert(stockPriceSnapshots).values({
          stockId: stock.stockId,
          snapshotTime: new Date(priceData.trade_time),
          open: String(priceData.open),
          high: String(priceData.high),
          low: String(priceData.low),
          close: String(priceData.close),
          volume: priceData.vol ? String(priceData.vol) : null,
          amount: priceData.amount ? String(priceData.amount) : null,
          changePct: priceData.pct_chg ? String(priceData.pct_chg) : null,
          createdAt: now,
        })

        savedCount++
      } catch (error) {
        console.error(`[Cron] Failed to save price for ${stock.tsCode}:`, error)
      }
    }

    console.log(`[Cron] Successfully saved ${savedCount}/${monitoredStocks.length} prices`)

    // 6. 清理7天前的旧数据 (保持数据量可控)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const deletedResult = await db
      .delete(stockPriceSnapshots)
      .where(eq(stockPriceSnapshots.snapshotTime, sevenDaysAgo))

    return NextResponse.json({
      success: true,
      message: 'Price collection completed',
      collected: savedCount,
      total: monitoredStocks.length,
      timestamp: now.toISOString(),
    })
  } catch (error) {
    console.error('[Cron] Price collection failed:', error)
    return NextResponse.json(
      {
        error: 'Price collection failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
