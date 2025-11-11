import type { ConnectionManager } from '../managers/connection-manager'
import type { SubscriptionManager } from '../managers/subscription-manager'
import type { RealtimeQuote } from '../types'

const FETCH_INTERVAL = 1000 // 1秒推送间隔
const BATCH_SIZE = 800 // 新浪API单次最多支持约800个股票代码

/**
 * 股票数据服务
 * 负责定时批量获取所有订阅股票的实时数据，并推送给订阅者
 */
export class StockDataService {
  private intervalId: NodeJS.Timeout | null = null
  private isRunning = false

  constructor(
    private subscriptionManager: SubscriptionManager,
    private connectionManager: ConnectionManager
  ) { }

  /**
   * 启动定时数据推送
   */
  start(): void {
    if (this.isRunning) {
      console.warn('[StockDataService] 服务已在运行')
      return
    }

    this.isRunning = true
    this.intervalId = setInterval(() => {
      this.fetchAndPushData()
    }, FETCH_INTERVAL)

    console.log(`[StockDataService] 已启动，推送间隔 ${FETCH_INTERVAL}ms`)
  }

  /**
   * 停止定时数据推送
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.isRunning = false
    console.log('[StockDataService] 已停止')
  }

  /**
   * 获取并推送数据
   */
  private async fetchAndPushData(): Promise<void> {
    try {
      // 获取所有被订阅的股票
      const allStocks = this.subscriptionManager.getAllSubscribedStocks()

      if (allStocks.length === 0) {
        // 没有订阅，跳过
        return
      }

      // 批量获取实时数据
      const quotes = await this.fetchRealtimeQuotes(allStocks)

      // 推送给订阅者
      this.pushQuotesToSubscribers(quotes)
    } catch (error) {
      console.error('[StockDataService] 获取和推送数据失败:', error)
    }
  }

  /**
   * 批量获取股票实时行情
   */
  private async fetchRealtimeQuotes(tsCodes: string[]): Promise<Map<string, RealtimeQuote>> {
    const result = new Map<string, RealtimeQuote>()

    if (tsCodes.length === 0) {
      return result
    }

    try {
      // 将股票代码分批处理（新浪API有长度限制）
      const batches: string[][] = []
      for (let i = 0; i < tsCodes.length; i += BATCH_SIZE) {
        batches.push(tsCodes.slice(i, i + BATCH_SIZE))
      }

      // 并发请求所有批次
      const batchResults = await Promise.all(
        batches.map((batch) => this.fetchBatchQuotes(batch))
      )

      // 合并结果
      for (const batchResult of batchResults) {
        for (const [tsCode, quote] of batchResult) {
          result.set(tsCode, quote)
        }
      }
    } catch (error) {
      console.error('[StockDataService] 批量获取行情失败:', error)
    }

    return result
  }

  /**
   * 获取单批股票行情
   */
  private async fetchBatchQuotes(tsCodes: string[]): Promise<Map<string, RealtimeQuote>> {
    const result = new Map<string, RealtimeQuote>()

    try {
      // 转换为新浪格式
      const sinaCodes = tsCodes.map(this.tsCodeToSina).join(',')

      // 直接请求新浪API
      const sinaUrl = `https://hq.sinajs.cn/list=${sinaCodes}`
      const response = await fetch(sinaUrl, {
        method: 'GET',
        headers: {
          Referer: 'https://finance.sina.com.cn',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      })

      if (!response.ok) {
        console.error(`[StockDataService] Sina API error: ${response.status}`)
        return result
      }

      const text = await response.text()

      // 解析返回数据
      const lines = text.split('\n').filter((line) => line.trim())

      for (let i = 0; i < lines.length && i < tsCodes.length; i++) {
        const line = lines[i]
        const tsCode = tsCodes[i]

        // 提取数据：var hq_str_sh600089="数据";
        const match = line.match(/var hq_str_\w+="([^"]+)"/)
        if (!match || !match[1]) {
          continue
        }

        const fields = match[1].split(',')

        // 验证字段数量
        if (fields.length < 32) {
          continue
        }

        // 解析字段
        const open = parseFloat(fields[1])
        const prevClose = parseFloat(fields[2])
        const current = parseFloat(fields[3])
        const high = parseFloat(fields[4])
        const low = parseFloat(fields[5])
        const volumeInShares = parseFloat(fields[8])
        const amountInYuan = parseFloat(fields[9])

        // 数据有效性检查
        if (isNaN(current) || current <= 0) {
          continue
        }

        // 计算涨跌
        const change = current - prevClose
        const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0

        result.set(tsCode, {
          tsCode,
          currentPrice: current,
          change,
          changePercent,
          open,
          high,
          low,
          preClose: prevClose,
          volume: volumeInShares,
          amount: amountInYuan,
          timestamp: Date.now(),
        })
      }
    } catch (error) {
      console.error('[StockDataService] 获取批次行情失败:', error)
    }

    return result
  }

  /**
   * 推送行情数据给订阅者
   */
  private pushQuotesToSubscribers(quotes: Map<string, RealtimeQuote>): void {
    let totalPushCount = 0

    for (const [tsCode, quote] of quotes) {
      // 获取订阅该股票的用户
      const subscribers = this.subscriptionManager.getStockSubscribers(tsCode)

      if (subscribers.length === 0) {
        continue
      }

      // 推送给所有订阅者
      const pushCount = this.connectionManager.sendToUsers(subscribers, {
        type: 'stock_update',
        payload: quote,
      })

      totalPushCount += pushCount
    }
  }

  /**
   * 将Tushare格式代码转换为新浪格式
   */
  private tsCodeToSina(tsCode: string): string {
    const [symbol, exchange] = tsCode.split('.')
    const prefix =
      exchange === 'SH' ? 'sh' : exchange === 'SZ' ? 'sz' : exchange === 'BJ' ? 'bj' : ''
    return `${prefix}${symbol}`.toLowerCase()
  }
}
