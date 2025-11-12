/**
 * 时间窗口数据管理器
 * 用于维护每只股票1小时的历史数据,支持智能压缩
 */

import type { RealtimeQuote } from '@/lib/websocket/types'
import type { DataPoint, TimeWindow } from './types'

export class TimeWindowManager {
  private windows: Map<string, TimeWindow> = new Map()
  private readonly WINDOW_DURATION = 60 * 60 * 1000 // 1小时
  private readonly COMPRESSION_THRESHOLD = 0.0001 // 0.01% 变化阈值

  /**
   * 添加数据点
   * 如果变化小于阈值,则跳过存储(智能压缩)
   */
  addDataPoint(stockCode: string, quote: RealtimeQuote): void {
    let window = this.windows.get(stockCode)

    if (!window) {
      // 创建新窗口
      window = {
        stockCode,
        dataPoints: [],
        lastVolume: quote.volume,
      }
      this.windows.set(stockCode, window)
    }

    const now = Date.now()
    const dataPoint: DataPoint = {
      timestamp: now,
      volume: quote.volume,
      price: quote.currentPrice,
      changePercent: parseFloat(String(quote.changePercent || 0)),
    }

    // 智能压缩:检查是否需要存储
    const shouldStore = this.shouldStoreDataPoint(window, dataPoint)

    if (shouldStore) {
      window.dataPoints.push(dataPoint)
    }

    // 更新 lastVolume
    window.lastVolume = quote.volume

    // 清理过期数据
    this.cleanupExpiredData(window, now)
  }

  /**
   * 判断是否应该存储数据点
   * 使用智能压缩:如果变化太小则跳过
   */
  private shouldStoreDataPoint(window: TimeWindow, newPoint: DataPoint): boolean {
    if (window.dataPoints.length === 0) {
      return true // 第一个数据点必须存储
    }

    const lastPoint = window.dataPoints[window.dataPoints.length - 1]

    // 检查价格变化
    const priceChange = Math.abs(newPoint.price - lastPoint.price) / lastPoint.price
    if (priceChange > this.COMPRESSION_THRESHOLD) {
      return true
    }

    // 检查成交量变化
    const volumeChange = Math.abs(newPoint.volume - lastPoint.volume) / lastPoint.volume
    if (volumeChange > this.COMPRESSION_THRESHOLD) {
      return true
    }

    // 每30秒至少保留一个数据点(避免完全无数据)
    const timeSinceLastPoint = newPoint.timestamp - lastPoint.timestamp
    if (timeSinceLastPoint > 30 * 1000) {
      return true
    }

    return false
  }

  /**
   * 清理过期数据 (1小时前)
   */
  private cleanupExpiredData(window: TimeWindow, now: number): void {
    const expireTime = now - this.WINDOW_DURATION

    // 使用二分查找找到第一个未过期的索引
    let left = 0
    let right = window.dataPoints.length

    while (left < right) {
      const mid = Math.floor((left + right) / 2)
      if (window.dataPoints[mid].timestamp < expireTime) {
        left = mid + 1
      } else {
        right = mid
      }
    }

    // 删除过期数据
    if (left > 0) {
      window.dataPoints.splice(0, left)
    }
  }

  /**
   * 获取当前1秒的成交量增量
   */
  getVolumeIncrement(stockCode: string): number {
    const window = this.windows.get(stockCode)
    if (!window || window.dataPoints.length === 0) {
      return 0
    }

    // 获取当前累计成交量
    const currentVolume = window.lastVolume

    // 获取1秒前的成交量
    const now = Date.now()
    const oneSecondAgo = now - 1000

    // 找到最接近1秒前的数据点
    let previousVolume = currentVolume

    for (let i = window.dataPoints.length - 1; i >= 0; i--) {
      const point = window.dataPoints[i]
      if (point.timestamp <= oneSecondAgo) {
        previousVolume = point.volume
        break
      }
    }

    return Math.max(0, currentVolume - previousVolume)
  }

  /**
   * 获取前N分钟的平均成交量增量
   */
  getAverageVolumeIncrement(stockCode: string, minutes: number): number {
    const window = this.windows.get(stockCode)
    if (!window || window.dataPoints.length < 2) {
      return 0
    }

    const now = Date.now()
    const periodStart = now - minutes * 60 * 1000

    // 过滤出时间范围内的数据点
    const dataPointsInRange = window.dataPoints.filter((point) => point.timestamp >= periodStart)

    if (dataPointsInRange.length < 2) {
      return 0
    }

    // 计算每秒平均增量
    const firstPoint = dataPointsInRange[0]
    const lastPoint = dataPointsInRange[dataPointsInRange.length - 1]

    const volumeDiff = lastPoint.volume - firstPoint.volume
    const timeDiff = (lastPoint.timestamp - firstPoint.timestamp) / 1000 // 转为秒

    if (timeDiff === 0) {
      return 0
    }

    return volumeDiff / timeDiff
  }

  /**
   * 获取前N分钟的成交量总量
   */
  getTotalVolume(stockCode: string, minutes: number): number {
    const window = this.windows.get(stockCode)
    if (!window || window.dataPoints.length < 2) {
      return 0
    }

    const now = Date.now()
    const periodStart = now - minutes * 60 * 1000

    // 找到时间范围的起点和终点
    const dataPointsInRange = window.dataPoints.filter((point) => point.timestamp >= periodStart)

    if (dataPointsInRange.length < 2) {
      return 0
    }

    const firstVolume = dataPointsInRange[0].volume
    const lastVolume = dataPointsInRange[dataPointsInRange.length - 1].volume

    return Math.max(0, lastVolume - firstVolume)
  }

  /**
   * 获取内存占用统计
   */
  getMemoryUsage(): {
    stockCount: number
    totalDataPoints: number
    estimatedBytes: number
    averagePointsPerStock: number
  } {
    let totalDataPoints = 0

    this.windows.forEach((window) => {
      totalDataPoints += window.dataPoints.length
    })

    // 估算内存占用
    // 每个 DataPoint 约 32 字节 (4个number)
    const estimatedBytes = totalDataPoints * 32

    return {
      stockCount: this.windows.size,
      totalDataPoints,
      estimatedBytes,
      averagePointsPerStock: this.windows.size > 0 ? totalDataPoints / this.windows.size : 0,
    }
  }

  /**
   * 清空某只股票的数据
   */
  clearStock(stockCode: string): void {
    this.windows.delete(stockCode)
  }

  /**
   * 清空所有数据
   */
  clearAll(): void {
    this.windows.clear()
  }

  /**
   * 获取调试信息
   */
  getDebugInfo(stockCode: string): {
    dataPoints: number
    oldestTimestamp: number
    newestTimestamp: number
    timeSpan: string
  } | null {
    const window = this.windows.get(stockCode)
    if (!window || window.dataPoints.length === 0) {
      return null
    }

    const oldest = window.dataPoints[0].timestamp
    const newest = window.dataPoints[window.dataPoints.length - 1].timestamp
    const spanSeconds = (newest - oldest) / 1000

    return {
      dataPoints: window.dataPoints.length,
      oldestTimestamp: oldest,
      newestTimestamp: newest,
      timeSpan: `${Math.floor(spanSeconds / 60)}分${Math.floor(spanSeconds % 60)}秒`,
    }
  }
}
