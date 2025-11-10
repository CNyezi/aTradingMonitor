/**
 * Tushare Pro API Client
 * 文档: https://tushare.pro/document/2
 */

interface TushareResponse<T> {
  code: number
  msg: string | null
  data: {
    fields: string[]
    items: Array<Array<string | number | null>>
  } | null
}

export interface StockBasicItem {
  ts_code: string // 股票代码 (如 "000001.SZ")
  symbol: string // 股票简称 (如 "000001")
  name: string // 股票名称
  area: string | null // 地域
  industry: string | null // 所属行业
  market: string | null // 市场类型 (主板/创业板等)
  list_date: string | null // 上市日期 (YYYYMMDD)
}

/**
 * 股票分钟行情数据
 * 接口: stk_mins (需要120积分)
 * 文档: https://tushare.pro/document/2?doc_id=109
 */
export interface StockMinuteItem {
  ts_code: string // 股票代码
  trade_time: string // 交易时间 (YYYY-MM-DD HH:MM:SS)
  open: number // 开盘价
  high: number // 最高价
  low: number // 最低价
  close: number // 收盘价
  vol: number // 成交量 (手)
  amount: number // 成交额 (千元)
  change: number // 涨跌额
  pct_chg: number // 涨跌幅 (%)
}

export class TushareClient {
  private readonly apiUrl = 'http://api.tushare.pro'
  private readonly token: string

  constructor(token?: string) {
    this.token = token || process.env.TUSHARE_TOKEN || ''
    if (!this.token) {
      throw new Error('TUSHARE_TOKEN is not configured')
    }
  }

  /**
   * 通用 API 请求方法
   */
  private async request<T>(
    apiName: string,
    params: Record<string, any> = {},
    fields: string = ''
  ): Promise<TushareResponse<T>> {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_name: apiName,
          token: this.token,
          params,
          fields,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return data as TushareResponse<T>
    } catch (error) {
      console.error(`[Tushare] API request failed: ${apiName}`, error)
      throw error
    }
  }

  /**
   * 获取股票基础信息列表
   * 接口: stock_basic
   * 文档: https://tushare.pro/document/2?doc_id=25
   *
   * @param listStatus - L上市 D退市 P暂停上市,默认是L
   * @param exchange - 交易所 SSE上交所 SZSE深交所 BSE北交所
   */
  async getStockBasic(params?: {
    listStatus?: 'L' | 'D' | 'P'
    exchange?: 'SSE' | 'SZSE' | 'BSE'
    tsCode?: string
  }): Promise<StockBasicItem[]> {
    const response = await this.request<StockBasicItem>(
      'stock_basic',
      {
        list_status: params?.listStatus || 'L',
        exchange: params?.exchange || '',
        ts_code: params?.tsCode || '',
      },
      'ts_code,symbol,name,area,industry,market,list_date'
    )

    if (response.code !== 0) {
      throw new Error(`Tushare API error: ${response.msg || 'Unknown error'}`)
    }

    if (!response.data || !response.data.items) {
      return []
    }

    // 将数组数据转换为对象
    const fields = response.data.fields
    return response.data.items.map((item) => {
      const stock: any = {}
      fields.forEach((field, index) => {
        stock[field] = item[index]
      })
      return stock as StockBasicItem
    })
  }

  /**
   * 带重试机制的股票列表获取
   */
  async getStockBasicWithRetry(
    params?: {
      listStatus?: 'L' | 'D' | 'P'
      exchange?: 'SSE' | 'SZSE' | 'BSE'
    },
    maxRetries = 3
  ): Promise<StockBasicItem[]> {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.getStockBasic(params)
      } catch (error) {
        lastError = error as Error
        console.warn(`[Tushare] Attempt ${attempt}/${maxRetries} failed:`, error)

        if (attempt < maxRetries) {
          // 指数退避: 2^attempt * 1000ms
          const delay = Math.pow(2, attempt) * 1000
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }
    }

    throw lastError || new Error('Failed to fetch stock data after retries')
  }

  /**
   * 获取股票分钟级行情数据
   * 接口: stk_mins (需要120积分)
   * 文档: https://tushare.pro/document/2?doc_id=109
   *
   * @param tsCode - 股票代码 (必填, 如 "000001.SZ")
   * @param freq - 分钟频度 (1min, 5min, 15min, 30min, 60min), 默认 1min
   * @param startDate - 开始日期 (YYYYMMDD)
   * @param endDate - 结束日期 (YYYYMMDD)
   * @param startTime - 开始时间 (HHMM)
   * @param endTime - 结束时间 (HHMM)
   *
   * 注意:
   * 1. 单次最多提取8000行记录
   * 2. 总量不限制
   * 3. 权限要求: 120积分以上
   */
  async getStockMinutes(params: {
    tsCode: string
    freq?: '1min' | '5min' | '15min' | '30min' | '60min'
    startDate?: string
    endDate?: string
    startTime?: string
    endTime?: string
  }): Promise<StockMinuteItem[]> {
    const response = await this.request<StockMinuteItem>(
      'stk_mins',
      {
        ts_code: params.tsCode,
        freq: params.freq || '1min',
        start_date: params.startDate || '',
        end_date: params.endDate || '',
        start_time: params.startTime || '',
        end_time: params.endTime || '',
      },
      'ts_code,trade_time,open,high,low,close,vol,amount,change,pct_chg'
    )

    if (response.code !== 0) {
      throw new Error(`Tushare API error: ${response.msg || 'Unknown error'}`)
    }

    if (!response.data || !response.data.items) {
      return []
    }

    // 将数组数据转换为对象
    const fields = response.data.fields
    return response.data.items.map((item) => {
      const minute: any = {}
      fields.forEach((field, index) => {
        minute[field] = item[index]
      })
      return minute as StockMinuteItem
    })
  }

  /**
   * 批量获取多个股票的最新分钟行情
   * 用于实时监控场景
   *
   * @param tsCodes - 股票代码数组
   * @param freq - 分钟频度, 默认 1min
   * @returns 股票代码到分钟行情的映射
   */
  async getBatchLatestMinutes(
    tsCodes: string[],
    freq: '1min' | '5min' | '15min' | '30min' | '60min' = '1min'
  ): Promise<Map<string, StockMinuteItem | null>> {
    const result = new Map<string, StockMinuteItem | null>()

    // 获取今天的日期 (YYYYMMDD)
    const today = new Date()
    const dateStr =
      today.getFullYear() +
      String(today.getMonth() + 1).padStart(2, '0') +
      String(today.getDate()).padStart(2, '0')

    // 串行请求避免API限流 (每分钟200次)
    for (const tsCode of tsCodes) {
      try {
        const data = await this.getStockMinutes({
          tsCode,
          freq,
          startDate: dateStr,
          endDate: dateStr,
        })

        // 取最新的一条记录
        result.set(tsCode, data.length > 0 ? data[data.length - 1] : null)

        // 每次请求后延迟 300ms (避免触发限流: 200次/分钟 = 每300ms一次)
        await new Promise((resolve) => setTimeout(resolve, 300))
      } catch (error) {
        console.error(`[Tushare] Failed to fetch minutes for ${tsCode}:`, error)
        result.set(tsCode, null)
      }
    }

    return result
  }
}

// 导出单例
let tushareClient: TushareClient | null = null

export function getTushareClient(): TushareClient {
  if (!tushareClient) {
    tushareClient = new TushareClient()
  }
  return tushareClient
}
