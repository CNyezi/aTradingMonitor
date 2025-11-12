import type { RealtimeQuote } from '@/lib/websocket/types'

/**
 * 测试数据生成器
 * 生成模拟的股票行情数据,用于测试告警功能
 */
export class TestDataGenerator {
  private baseStocks = [
    { tsCode: '000001.SZ', name: '平安银行', basePrice: 15.5 },
    { tsCode: '600000.SH', name: '浦发银行', basePrice: 8.2 },
    { tsCode: '000002.SZ', name: '万科A', basePrice: 12.3 },
    { tsCode: '601318.SH', name: '中国平安', basePrice: 45.6 },
    { tsCode: '600519.SH', name: '贵州茅台', basePrice: 1680.0 },
  ]

  private stockStates: Map<
    string,
    {
      currentPrice: number
      volume: number
      changePercent: number
      trend: 'up' | 'down' | 'stable'
      trendStrength: number // 0-1, 趋势强度
      volatilityMode: 'normal' | 'spike' | 'limit' // 波动模式
    }
  > = new Map()

  constructor() {
    // 初始化股票状态
    this.baseStocks.forEach((stock) => {
      this.stockStates.set(stock.tsCode, {
        currentPrice: stock.basePrice,
        volume: Math.floor(Math.random() * 1000000) + 500000,
        changePercent: 0,
        trend: 'stable',
        trendStrength: 0,
        volatilityMode: 'normal',
      })
    })

    console.log('[TestDataGenerator] 初始化完成,模拟 5 只股票')
  }

  /**
   * 生成下一个行情快照
   */
  generateNextQuote(tsCode: string): RealtimeQuote | null {
    const baseStock = this.baseStocks.find((s) => s.tsCode === tsCode)
    if (!baseStock) return null

    const state = this.stockStates.get(tsCode)
    if (!state) return null

    // 更新股票状态
    this.updateStockState(tsCode, state, baseStock.basePrice)

    // 生成行情数据
    const quote: RealtimeQuote = {
      tsCode,
      name: baseStock.name,
      currentPrice: state.currentPrice,
      open: baseStock.basePrice,
      high: Math.max(state.currentPrice, baseStock.basePrice * 1.05),
      low: Math.min(state.currentPrice, baseStock.basePrice * 0.95),
      volume: state.volume,
      amount: state.volume * state.currentPrice,
      changePercent: state.changePercent,
      timestamp: new Date().toISOString(),
    }

    return quote
  }

  /**
   * 生成所有股票的行情快照
   */
  generateAllQuotes(): RealtimeQuote[] {
    return this.baseStocks.map((stock) => this.generateNextQuote(stock.tsCode)).filter(Boolean) as RealtimeQuote[]
  }

  /**
   * 更新股票状态 (模拟价格波动)
   */
  private updateStockState(
    tsCode: string,
    state: {
      currentPrice: number
      volume: number
      changePercent: number
      trend: 'up' | 'down' | 'stable'
      trendStrength: number
      volatilityMode: 'normal' | 'spike' | 'limit'
    },
    basePrice: number
  ): void {
    // 1. 随机切换波动模式 (每次有 5% 概率切换)
    if (Math.random() < 0.05) {
      const modes: Array<'normal' | 'spike' | 'limit'> = ['normal', 'spike', 'limit']
      state.volatilityMode = modes[Math.floor(Math.random() * modes.length)]
      console.log(`[TestDataGenerator] ${tsCode} 切换到 ${state.volatilityMode} 模式`)
    }

    // 2. 根据模式生成价格变动
    let priceChange = 0

    switch (state.volatilityMode) {
      case 'normal':
        // 正常模式: 小幅波动 (-0.5% ~ +0.5%)
        priceChange = (Math.random() - 0.5) * 0.01 * basePrice
        break

      case 'spike':
        // 激增模式: 快速上涨或下跌 (-3% ~ +6%)
        const direction = state.trend === 'up' ? 1 : state.trend === 'down' ? -1 : Math.random() > 0.5 ? 1 : -1
        state.trend = direction > 0 ? 'up' : 'down'
        state.trendStrength = 0.8
        priceChange = direction * (Math.random() * 0.03 + 0.03) * basePrice // 3%-6%
        console.log(`[TestDataGenerator] ${tsCode} 激增模式: ${direction > 0 ? '上涨' : '下跌'} ${((priceChange / basePrice) * 100).toFixed(2)}%`)
        break

      case 'limit':
        // 涨停/跌停模式: 接近 ±10%
        const limitDirection = Math.random() > 0.5 ? 1 : -1
        const targetChange = limitDirection * 0.099 * basePrice // 9.9%
        priceChange = targetChange - (state.currentPrice - basePrice) // 逐步接近涨停/跌停
        console.log(`[TestDataGenerator] ${tsCode} ${limitDirection > 0 ? '涨停' : '跌停'}模式`)
        break
    }

    // 3. 更新价格
    state.currentPrice = Math.max(0.01, state.currentPrice + priceChange)
    state.changePercent = ((state.currentPrice - basePrice) / basePrice) * 100

    // 4. 更新成交量 (模拟增量)
    let volumeIncrement = 0

    if (state.volatilityMode === 'spike') {
      // 激增模式: 成交量大幅增加 (平均增量的 3-5 倍)
      volumeIncrement = Math.floor(Math.random() * 10000) * (3 + Math.random() * 2)
    } else if (state.volatilityMode === 'limit') {
      // 涨停模式: 成交量激增 (平均增量的 5-8 倍)
      volumeIncrement = Math.floor(Math.random() * 10000) * (5 + Math.random() * 3)
    } else {
      // 正常模式: 正常成交量增量
      volumeIncrement = Math.floor(Math.random() * 5000) + 1000
    }

    state.volume += volumeIncrement

    // 5. 随机切换回正常模式 (激增/涨停模式有 20% 概率结束)
    if ((state.volatilityMode === 'spike' || state.volatilityMode === 'limit') && Math.random() < 0.2) {
      console.log(`[TestDataGenerator] ${tsCode} 退出 ${state.volatilityMode} 模式`)
      state.volatilityMode = 'normal'
      state.trend = 'stable'
      state.trendStrength = 0
    }
  }

  /**
   * 强制触发指定股票的告警 (用于测试)
   */
  triggerAlert(tsCode: string, alertType: 'price_up' | 'price_down' | 'limit_up' | 'limit_down' | 'volume_spike'): void {
    const state = this.stockStates.get(tsCode)
    if (!state) return

    const baseStock = this.baseStocks.find((s) => s.tsCode === tsCode)
    if (!baseStock) return

    switch (alertType) {
      case 'price_up':
        state.currentPrice = baseStock.basePrice * 1.06 // +6%
        state.changePercent = 6
        state.volatilityMode = 'spike'
        state.trend = 'up'
        break

      case 'price_down':
        state.currentPrice = baseStock.basePrice * 0.94 // -6%
        state.changePercent = -6
        state.volatilityMode = 'spike'
        state.trend = 'down'
        break

      case 'limit_up':
        state.currentPrice = baseStock.basePrice * 1.099 // +9.9%
        state.changePercent = 9.9
        state.volatilityMode = 'limit'
        state.trend = 'up'
        break

      case 'limit_down':
        state.currentPrice = baseStock.basePrice * 0.901 // -9.9%
        state.changePercent = -9.9
        state.volatilityMode = 'limit'
        state.trend = 'down'
        break

      case 'volume_spike':
        state.volatilityMode = 'spike'
        break
    }

    console.log(`[TestDataGenerator] 手动触发 ${tsCode} ${alertType} 告警`)
  }

  /**
   * 重置某只股票到初始状态
   */
  resetStock(tsCode: string): void {
    const baseStock = this.baseStocks.find((s) => s.tsCode === tsCode)
    if (!baseStock) return

    this.stockStates.set(tsCode, {
      currentPrice: baseStock.basePrice,
      volume: Math.floor(Math.random() * 1000000) + 500000,
      changePercent: 0,
      trend: 'stable',
      trendStrength: 0,
      volatilityMode: 'normal',
    })

    console.log(`[TestDataGenerator] 重置 ${tsCode} 到初始状态`)
  }

  /**
   * 获取所有股票代码
   */
  getAllStockCodes(): string[] {
    return this.baseStocks.map((s) => s.tsCode)
  }
}
