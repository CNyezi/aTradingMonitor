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

interface StockBasicItem {
  ts_code: string // 股票代码 (如 "000001.SZ")
  symbol: string // 股票简称 (如 "000001")
  name: string // 股票名称
  area: string | null // 地域
  industry: string | null // 所属行业
  market: string | null // 市场类型 (主板/创业板等)
  list_date: string | null // 上市日期 (YYYYMMDD)
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
}

// 导出单例
let tushareClient: TushareClient | null = null

export function getTushareClient(): TushareClient {
  if (!tushareClient) {
    tushareClient = new TushareClient()
  }
  return tushareClient
}
