/**
 * 盘中历史数据管理器
 *
 * 功能：
 * - 存储当天的实时行情数据（秒级精度）
 * - 提供历史数据查询功能
 * - 自动清理过期数据（每天凌晨清空）
 * - 数据量估算：10只股票 × 14400秒 × 32bytes = 4.5MB
 */

import type { RealtimeQuote } from '@/lib/websocket/types'

/**
 * 历史数据点
 */
export interface IntradayDataPoint {
  timestamp: number // Unix 时间戳（毫秒）
  currentPrice: number
  changePercent: number
  volume: number // 累计成交量
  amount: number // 累计成交额
}

/**
 * 盘中历史数据管理器
 */
export class IntradayHistoryManager {
  // 存储结构: Map<tsCode, IntradayDataPoint[]>
  private historyData: Map<string, IntradayDataPoint[]> = new Map()

  // 最大数据点数量（默认保存4小时 × 3600秒 = 14400个数据点）
  private maxDataPoints: number

  // 清理定时器
  private cleanupTimer: NodeJS.Timeout | null = null

  constructor(maxDataPoints: number = 14400) {
    this.maxDataPoints = maxDataPoints
    this.scheduleDailyCleanup()
  }

  /**
   * 添加新的数据点
   */
  addDataPoint(quote: RealtimeQuote): void {
    const dataPoint: IntradayDataPoint = {
      timestamp: quote.timestamp,
      currentPrice: quote.currentPrice,
      changePercent: parseFloat(String(quote.changePercent || 0)),
      volume: quote.volume,
      amount: quote.amount,
    }

    const history = this.historyData.get(quote.tsCode) || []

    // 添加新数据点
    history.push(dataPoint)

    // 如果超过最大数量，删除最旧的数据
    if (history.length > this.maxDataPoints) {
      history.shift()
    }

    this.historyData.set(quote.tsCode, history)
  }

  /**
   * 获取指定股票的所有历史数据
   */
  getHistory(tsCode: string): IntradayDataPoint[] {
    return this.historyData.get(tsCode) || []
  }

  /**
   * 获取指定股票在某个时间范围内的历史数据
   *
   * @param tsCode 股票代码
   * @param startTime 开始时间（Unix时间戳，毫秒）
   * @param endTime 结束时间（Unix时间戳，毫秒）
   */
  getHistoryInRange(tsCode: string, startTime: number, endTime: number): IntradayDataPoint[] {
    const history = this.historyData.get(tsCode) || []
    return history.filter((point) => point.timestamp >= startTime && point.timestamp <= endTime)
  }

  /**
   * 获取最近N分钟的历史数据
   *
   * @param tsCode 股票代码
   * @param minutes 分钟数
   */
  getRecentHistory(tsCode: string, minutes: number): IntradayDataPoint[] {
    const now = Date.now()
    const startTime = now - minutes * 60 * 1000
    return this.getHistoryInRange(tsCode, startTime, now)
  }

  /**
   * 获取最近N个数据点
   *
   * @param tsCode 股票代码
   * @param count 数据点数量
   */
  getRecentDataPoints(tsCode: string, count: number): IntradayDataPoint[] {
    const history = this.historyData.get(tsCode) || []
    return history.slice(-count)
  }

  /**
   * 计算指定时间段的涨跌幅
   *
   * @param tsCode 股票代码
   * @param minutes 时间段（分钟）
   * @returns 涨跌幅百分比，如果数据不足返回null
   */
  calculateChangePercent(tsCode: string, minutes: number): number | null {
    const history = this.getRecentHistory(tsCode, minutes)

    if (history.length < 2) {
      return null
    }

    const firstPrice = history[0].currentPrice
    const lastPrice = history[history.length - 1].currentPrice

    return ((lastPrice - firstPrice) / firstPrice) * 100
  }

  /**
   * 计算指定时间段的平均价格
   *
   * @param tsCode 股票代码
   * @param minutes 时间段（分钟）
   * @returns 平均价格，如果数据不足返回null
   */
  calculateAveragePrice(tsCode: string, minutes: number): number | null {
    const history = this.getRecentHistory(tsCode, minutes)

    if (history.length === 0) {
      return null
    }

    const totalPrice = history.reduce((sum, point) => sum + point.currentPrice, 0)
    return totalPrice / history.length
  }

  /**
   * 获取当天最高价
   */
  getTodayHigh(tsCode: string): number | null {
    const history = this.historyData.get(tsCode) || []

    if (history.length === 0) {
      return null
    }

    return Math.max(...history.map((point) => point.currentPrice))
  }

  /**
   * 获取当天最低价
   */
  getTodayLow(tsCode: string): number | null {
    const history = this.historyData.get(tsCode) || []

    if (history.length === 0) {
      return null
    }

    return Math.min(...history.map((point) => point.currentPrice))
  }

  /**
   * 获取数据统计信息
   */
  getStats(): {
    stockCount: number
    totalDataPoints: number
    estimatedMemoryMB: number
  } {
    let totalDataPoints = 0

    for (const history of this.historyData.values()) {
      totalDataPoints += history.length
    }

    // 每个数据点约 32 bytes
    const estimatedMemoryBytes = totalDataPoints * 32
    const estimatedMemoryMB = estimatedMemoryBytes / (1024 * 1024)

    return {
      stockCount: this.historyData.size,
      totalDataPoints,
      estimatedMemoryMB: parseFloat(estimatedMemoryMB.toFixed(2)),
    }
  }

  /**
   * 清空指定股票的历史数据
   */
  clearHistory(tsCode: string): void {
    this.historyData.delete(tsCode)
  }

  /**
   * 清空所有历史数据
   */
  clearAll(): void {
    this.historyData.clear()
  }

  /**
   * 安排每日凌晨清理任务
   * 每天凌晨 00:05 自动清空所有数据
   */
  private scheduleDailyCleanup(): void {
    // 计算距离下一个凌晨00:05的时间
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 5, 0, 0) // 设置为凌晨00:05

    const timeUntilCleanup = tomorrow.getTime() - now.getTime()

    // 设置定时器
    this.cleanupTimer = setTimeout(() => {
      console.log('[IntradayHistoryManager] 执行每日数据清理')
      this.clearAll()

      // 重新安排下一次清理
      this.scheduleDailyCleanup()
    }, timeUntilCleanup)

    console.log(
      `[IntradayHistoryManager] 已安排每日清理，将于 ${tomorrow.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })} 执行`
    )
  }

  /**
   * 销毁管理器（清理定时器）
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearTimeout(this.cleanupTimer)
      this.cleanupTimer = null
    }
    this.clearAll()
  }
}
