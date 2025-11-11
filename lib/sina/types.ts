/**
 * 新浪财经实时行情接口类型定义
 */

/**
 * 新浪接口原始返回数据
 * 对应返回字符串的32个字段（逗号分隔）
 */
export interface SinaRawQuote {
  /** 0: 股票名称 */
  name: string
  /** 1: 今日开盘价 */
  open: string
  /** 2: 昨日收盘价 */
  prevClose: string
  /** 3: 当前价格 */
  current: string
  /** 4: 今日最高价 */
  high: string
  /** 5: 今日最低价 */
  low: string
  /** 6: 竞买价(买一) */
  bid: string
  /** 7: 竞卖价(卖一) */
  ask: string
  /** 8: 成交股票数（股） */
  volume: string
  /** 9: 成交金额（元） */
  amount: string
  /** 30: 交易日期 YYYY-MM-DD */
  date: string
  /** 31: 交易时间 HH:MM:SS */
  time: string
}

/**
 * 解析后的股票行情数据
 */
export interface SinaQuote {
  /** 股票代码（Tushare格式，如 600089.SH） */
  tsCode: string
  /** 股票名称 */
  name: string
  /** 当前价格 */
  currentPrice: number
  /** 涨跌额 */
  change: number
  /** 涨跌幅(%) */
  changePercent: number
  /** 今日开盘价 */
  open: number
  /** 今日最高价 */
  high: number
  /** 今日最低价 */
  low: number
  /** 昨日收盘价 */
  prevClose: number
  /** 成交量（手，1手=100股） */
  volume: number
  /** 成交额（万元） */
  amount: number
  /** 买一价 */
  bid: number
  /** 卖一价 */
  ask: number
  /** 更新时间 */
  updateTime: Date
}

/**
 * 批量查询结果
 */
export interface BatchQuoteResult {
  /** 成功获取的数据 */
  success: Map<string, SinaQuote>
  /** 失败的股票代码列表 */
  failed: string[]
}
