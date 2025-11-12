/**
 * Tushare 相关类型定义
 */

export interface TushareStockBasic {
  ts_code: string // 股票代码 (如 "000001.SZ")
  symbol: string // 股票简称 (如 "000001")
  name: string // 股票名称
  area: string | null // 地域
  industry: string | null // 所属行业
  market: string | null // 市场类型
  list_date: string | null // 上市日期 (YYYYMMDD)
}

export interface StockWithGroup {
  id: string
  tsCode: string
  symbol: string
  name: string
  area: string | null
  industry: string | null
  market: string | null
  listDate: string | null
  groupId: string | null
  groupName: string | null
  monitored: boolean
  addedAt: Date
  costPrice: string | null // 持仓成本价
  quantity: number | null // 持股数量
}
