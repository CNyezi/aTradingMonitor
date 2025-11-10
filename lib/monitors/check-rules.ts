/**
 * 监控规则检查引擎
 * 根据不同的规则类型检查价格数据，判断是否触发告警
 */

import { db } from '@/lib/db'
import { stockPriceSnapshots } from '@/lib/db/schema'
import { eq, desc, and, gte } from 'drizzle-orm'

/**
 * 监控规则配置类型
 */
export interface MonitorRuleConfig {
  // 价格变动监控 (price_change)
  priceChangeThreshold?: number // 涨跌幅阈值 (%)

  // 成交量异动监控 (volume_spike)
  volumeMultiplier?: number // 成交量倍数 (相对于平均值)
  volumePeriod?: number // 参考周期 (分钟)

  // 涨停/跌停监控 (limit_up/limit_down)
  limitThreshold?: number // 涨跌停阈值 (%, 默认10%)

  // 价格突破监控 (price_breakout)
  breakoutPrice?: number // 突破价格
  breakoutDirection?: 'up' | 'down' // 突破方向
}

/**
 * 告警触发数据
 */
export interface AlertTriggerData {
  currentPrice: number
  previousPrice?: number
  changePercent?: number
  currentVolume?: number
  avgVolume?: number
  volumeMultiplier?: number
  breakoutPrice?: number
  triggerTime: string
  [key: string]: any
}

/**
 * 获取股票的历史快照 (用于计算平均值等)
 */
async function getHistoricalSnapshots(stockId: string, minutesAgo: number) {
  const startTime = new Date()
  startTime.setMinutes(startTime.getMinutes() - minutesAgo)

  return db
    .select()
    .from(stockPriceSnapshots)
    .where(and(eq(stockPriceSnapshots.stockId, stockId), gte(stockPriceSnapshots.snapshotTime, startTime)))
    .orderBy(desc(stockPriceSnapshots.snapshotTime))
}

/**
 * 检查价格变动规则
 * 当涨跌幅超过设定阈值时触发
 */
export async function checkPriceChange(
  stockId: string,
  config: MonitorRuleConfig
): Promise<AlertTriggerData | null> {
  const threshold = config.priceChangeThreshold || 5 // 默认5%

  // 获取最新两条记录
  const snapshots = await db
    .select()
    .from(stockPriceSnapshots)
    .where(eq(stockPriceSnapshots.stockId, stockId))
    .orderBy(desc(stockPriceSnapshots.snapshotTime))
    .limit(2)

  if (snapshots.length < 2) {
    return null
  }

  const [latest, previous] = snapshots
  const currentPrice = parseFloat(latest.close)
  const previousPrice = parseFloat(previous.close)
  const changePercent = parseFloat(latest.changePct || '0')

  // 检查是否超过阈值
  if (Math.abs(changePercent) >= threshold) {
    return {
      currentPrice,
      previousPrice,
      changePercent,
      triggerTime: latest.snapshotTime.toISOString(),
    }
  }

  return null
}

/**
 * 检查成交量异动规则
 * 当成交量超过平均值的N倍时触发
 */
export async function checkVolumeSpike(
  stockId: string,
  config: MonitorRuleConfig
): Promise<AlertTriggerData | null> {
  const multiplier = config.volumeMultiplier || 2 // 默认2倍
  const period = config.volumePeriod || 60 // 默认60分钟

  // 获取最新快照
  const [latest] = await db
    .select()
    .from(stockPriceSnapshots)
    .where(eq(stockPriceSnapshots.stockId, stockId))
    .orderBy(desc(stockPriceSnapshots.snapshotTime))
    .limit(1)

  if (!latest || !latest.volume) {
    return null
  }

  // 获取历史数据计算平均成交量
  const historicalSnapshots = await getHistoricalSnapshots(stockId, period)

  if (historicalSnapshots.length < 2) {
    return null
  }

  const avgVolume =
    historicalSnapshots.reduce((sum, s) => sum + parseFloat(s.volume || '0'), 0) / historicalSnapshots.length

  const currentVolume = parseFloat(latest.volume)

  // 检查是否超过倍数
  if (currentVolume >= avgVolume * multiplier) {
    return {
      currentPrice: parseFloat(latest.close),
      currentVolume,
      avgVolume,
      volumeMultiplier: currentVolume / avgVolume,
      triggerTime: latest.snapshotTime.toISOString(),
    }
  }

  return null
}

/**
 * 检查涨停规则
 */
export async function checkLimitUp(stockId: string, config: MonitorRuleConfig): Promise<AlertTriggerData | null> {
  const threshold = config.limitThreshold || 10 // 默认10%

  const [latest] = await db
    .select()
    .from(stockPriceSnapshots)
    .where(eq(stockPriceSnapshots.stockId, stockId))
    .orderBy(desc(stockPriceSnapshots.snapshotTime))
    .limit(1)

  if (!latest || !latest.changePct) {
    return null
  }

  const changePercent = parseFloat(latest.changePct)

  // 检查是否接近涨停 (9.9%以上视为涨停)
  if (changePercent >= threshold * 0.99) {
    return {
      currentPrice: parseFloat(latest.close),
      changePercent,
      triggerTime: latest.snapshotTime.toISOString(),
    }
  }

  return null
}

/**
 * 检查跌停规则
 */
export async function checkLimitDown(stockId: string, config: MonitorRuleConfig): Promise<AlertTriggerData | null> {
  const threshold = config.limitThreshold || 10 // 默认10%

  const [latest] = await db
    .select()
    .from(stockPriceSnapshots)
    .where(eq(stockPriceSnapshots.stockId, stockId))
    .orderBy(desc(stockPriceSnapshots.snapshotTime))
    .limit(1)

  if (!latest || !latest.changePct) {
    return null
  }

  const changePercent = parseFloat(latest.changePct)

  // 检查是否接近跌停 (-9.9%以下视为跌停)
  if (changePercent <= -threshold * 0.99) {
    return {
      currentPrice: parseFloat(latest.close),
      changePercent,
      triggerTime: latest.snapshotTime.toISOString(),
    }
  }

  return null
}

/**
 * 检查价格突破规则
 */
export async function checkPriceBreakout(
  stockId: string,
  config: MonitorRuleConfig
): Promise<AlertTriggerData | null> {
  const { breakoutPrice, breakoutDirection } = config

  if (!breakoutPrice || !breakoutDirection) {
    return null
  }

  // 获取最新两条记录
  const snapshots = await db
    .select()
    .from(stockPriceSnapshots)
    .where(eq(stockPriceSnapshots.stockId, stockId))
    .orderBy(desc(stockPriceSnapshots.snapshotTime))
    .limit(2)

  if (snapshots.length < 2) {
    return null
  }

  const [latest, previous] = snapshots
  const currentPrice = parseFloat(latest.close)
  const previousPrice = parseFloat(previous.close)

  // 检查向上突破
  if (breakoutDirection === 'up' && previousPrice < breakoutPrice && currentPrice >= breakoutPrice) {
    return {
      currentPrice,
      previousPrice,
      breakoutPrice,
      changePercent: parseFloat(latest.changePct || '0'),
      triggerTime: latest.snapshotTime.toISOString(),
    }
  }

  // 检查向下突破
  if (breakoutDirection === 'down' && previousPrice > breakoutPrice && currentPrice <= breakoutPrice) {
    return {
      currentPrice,
      previousPrice,
      breakoutPrice,
      changePercent: parseFloat(latest.changePct || '0'),
      triggerTime: latest.snapshotTime.toISOString(),
    }
  }

  return null
}

/**
 * 根据规则类型执行检查
 */
export async function checkRule(
  ruleType: 'price_change' | 'volume_spike' | 'limit_up' | 'limit_down' | 'price_breakout',
  stockId: string,
  config: MonitorRuleConfig
): Promise<AlertTriggerData | null> {
  switch (ruleType) {
    case 'price_change':
      return checkPriceChange(stockId, config)
    case 'volume_spike':
      return checkVolumeSpike(stockId, config)
    case 'limit_up':
      return checkLimitUp(stockId, config)
    case 'limit_down':
      return checkLimitDown(stockId, config)
    case 'price_breakout':
      return checkPriceBreakout(stockId, config)
    default:
      return null
  }
}
