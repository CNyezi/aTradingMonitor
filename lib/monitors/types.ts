/**
 * 监控系统统一类型定义
 */

import type { RealtimeQuote } from '@/lib/websocket/types'
import type { MonitorRuleConfig } from './check-rules'

/**
 * 告警状态
 */
export type AlertStatus = 'OPEN' | 'ACTIVE' | 'CLOSED'

/**
 * 告警状态详情
 */
export interface AlertState {
  /** 当前状态 */
  status: AlertStatus
  /** 告警打开时间 */
  openTime: number
  /** 最后检查时间 */
  lastCheckTime: number
  /** 触发时的数据快照 */
  triggerData: RealtimeAlertData
}

/**
 * 告警数据
 */
export interface RealtimeAlertData {
  stockCode: string
  alertType: 'price_change' | 'volume_spike' | 'limit_up' | 'limit_down' | 'price_breakout'
  message: string
  currentPrice: number
  changePercent: number
  triggerTime: Date
  triggerData: Record<string, any>
}

/**
 * 规则检查结果
 */
export interface AlertCheckResult {
  /** 是否应该打开新告警 */
  shouldOpen: boolean
  /** 是否应该关闭现有告警 */
  shouldClose: boolean
  /** 告警数据 (仅在 shouldOpen=true 时有效) */
  alertData?: RealtimeAlertData
}

/**
 * 时间窗口数据点
 */
export interface DataPoint {
  timestamp: number
  volume: number
  price: number
  changePercent: number
}

/**
 * 时间窗口
 */
export interface TimeWindow {
  stockCode: string
  dataPoints: DataPoint[]
  lastVolume: number // 用于计算增量
}

/**
 * 规则检查函数类型
 */
export type RuleCheckFunction = (
  quote: RealtimeQuote,
  config: MonitorRuleConfig,
  currentAlertState?: AlertState,
  context?: RuleCheckContext
) => AlertCheckResult

/**
 * 规则检查上下文
 */
export interface RuleCheckContext {
  previousQuote?: RealtimeQuote
  timeWindowManager?: any // 避免循环依赖,使用 any
}
