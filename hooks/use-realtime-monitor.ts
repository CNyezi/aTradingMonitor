'use client'

import { useWebSocket } from '@/contexts/WebSocketContext'
import type { RealtimeQuote } from '@/lib/websocket/types'
import { checkAllRules } from '@/lib/monitors/realtime-check'
import type { MonitorRuleConfig } from '@/lib/monitors/check-rules'
import type { AlertState, RealtimeAlertData } from '@/lib/monitors/types'
import { TimeWindowManager } from '@/lib/monitors/time-window-manager'
import { IntradayHistoryManager } from '@/lib/monitors/intraday-history-manager'
import { getStockRules } from '@/actions/monitors'
import { useEffect, useRef, useState, useCallback } from 'react'
import { toast } from 'sonner'

/**
 * 监控的股票
 */
interface MonitoredStock {
  id: string
  tsCode: string
  name?: string
  monitored: boolean
}

/**
 * 监控规则类型
 */
interface MonitorRule {
  id: string
  stockCode: string
  ruleType: string
  ruleName?: string
  enabled: boolean
  config: MonitorRuleConfig
}

/**
 * 告警去重Key: stockCode + alertType
 */
type AlertKey = string

/**
 * 前端实时监控引擎 - 状态机版本 + 关联模式
 *
 * 特性：
 * 1. 基于股票-规则关联关系的监控
 * 2. 基于 WebSocket 实时数据流进行规则检查
 * 3. 状态机管理: OPEN -> ACTIVE -> CLOSED
 * 4. 时间窗口管理: 1小时滑动窗口 + 智能压缩
 * 5. 通知冷却: 仅在 OPEN 状态发送通知，避免重复
 * 6. 支持浏览器桌面通知
 */
export function useRealtimeMonitor(monitoredStocks: MonitoredStock[]) {
  const { client, isConnected } = useWebSocket()

  // 存储从API加载的监控任务 (股票-规则关联)
  const [monitorRules, setMonitorRules] = useState<MonitorRule[]>([])

  // 存储每只股票的上一次行情数据
  const previousQuotesRef = useRef<Map<string, RealtimeQuote>>(new Map())

  // 告警状态管理Map: alertKey -> AlertState
  const alertStatesRef = useRef<Map<AlertKey, AlertState>>(new Map())

  // 时间窗口管理器 (1小时历史数据)
  const timeWindowManagerRef = useRef<TimeWindowManager>(new TimeWindowManager())

  // 盘中历史数据管理器 (当天全天数据)
  const intradayHistoryManagerRef = useRef<IntradayHistoryManager>(new IntradayHistoryManager())

  // 通知冷却时间（5分钟）- 仅用于防止同一告警短时间内重复通知
  const notificationCooldownRef = useRef<Map<AlertKey, number>>(new Map())
  const NOTIFICATION_COOLDOWN_MS = 5 * 60 * 1000

  // 浏览器通知权限状态
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default')

  /**
   * 从API加载股票-规则关联关系
   */
  useEffect(() => {
    async function loadMonitorTasks() {
      if (monitoredStocks.length === 0) {
        setMonitorRules([])
        return
      }

      const tasks: MonitorRule[] = []

      // 为每只监控的股票加载关联的规则
      await Promise.all(
        monitoredStocks.map(async (stock) => {
          try {
            const result = await getStockRules(stock.id)
            if (result.success && result.data && typeof result.data === 'object' && 'associations' in result.data) {
              const associations = result.data.associations as any[]
              for (const assoc of associations) {
                // 只添加启用的关联 + 启用的规则
                if (assoc.enabled && assoc.rule.enabled) {
                  tasks.push({
                    id: `${stock.id}-${assoc.rule.id}`,
                    stockCode: stock.tsCode,
                    ruleType: assoc.rule.ruleType,
                    ruleName: assoc.rule.ruleName,
                    enabled: true,
                    config: assoc.rule.config,
                  })
                }
              }
            }
          } catch (error) {
            console.error(`[RealtimeMonitor] 加载股票 ${stock.tsCode} 的规则失败:`, error)
          }
        })
      )

      setMonitorRules(tasks)
      console.log(`[RealtimeMonitor] 已加载 ${tasks.length} 个监控任务`)
    }

    loadMonitorTasks()
  }, [monitoredStocks])

  /**
   * 请求浏览器通知权限
   */
  const requestNotificationPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      console.warn('[RealtimeMonitor] 浏览器不支持桌面通知')
      return
    }

    if (Notification.permission === 'granted') {
      setNotificationPermission('granted')
      return
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission()
      setNotificationPermission(permission)
    }
  }, [])

  /**
   * 发送浏览器桌面通知
   */
  const sendBrowserNotification = useCallback((alert: RealtimeAlertData) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return
    }

    try {
      const notification = new Notification('股票监控告警', {
        body: alert.message,
        icon: '/favicon.ico',
        tag: `${alert.stockCode}-${alert.alertType}`, // 相同tag会替换旧通知
        requireInteraction: false,
      })

      // 3秒后自动关闭
      setTimeout(() => notification.close(), 3000)
    } catch (error) {
      console.error('[RealtimeMonitor] 发送桌面通知失败:', error)
    }
  }, [])

  /**
   * 检查通知是否在冷却期内
   */
  const isNotificationInCooldown = useCallback((stockCode: string, alertType: string): boolean => {
    const alertKey = `${stockCode}:${alertType}`
    const lastNotificationTime = notificationCooldownRef.current.get(alertKey)

    if (!lastNotificationTime) {
      return false
    }

    const elapsed = Date.now() - lastNotificationTime
    return elapsed < NOTIFICATION_COOLDOWN_MS
  }, [])

  /**
   * 标记通知已发送（用于冷却）
   */
  const markNotificationSent = useCallback((stockCode: string, alertType: string) => {
    const alertKey = `${stockCode}:${alertType}`
    notificationCooldownRef.current.set(alertKey, Date.now())
  }, [])

  /**
   * 清理过期的通知冷却记录
   */
  const cleanupExpiredCooldowns = useCallback(() => {
    const now = Date.now()
    const expiredKeys: string[] = []

    notificationCooldownRef.current.forEach((timestamp, key) => {
      if (now - timestamp > NOTIFICATION_COOLDOWN_MS) {
        expiredKeys.push(key)
      }
    })

    expiredKeys.forEach((key) => {
      notificationCooldownRef.current.delete(key)
    })
  }, [])

  /**
   * 处理告警通知发送 (仅在 OPEN 状态调用)
   */
  const sendAlertNotification = useCallback((alert: RealtimeAlertData) => {
    // 检查通知冷却期 (避免短时间内重复通知)
    if (isNotificationInCooldown(alert.stockCode, alert.alertType)) {
      console.log(`[RealtimeMonitor] 通知 ${alert.stockCode}:${alert.alertType} 在冷却期内，跳过`)
      return
    }

    // 标记通知已发送
    markNotificationSent(alert.stockCode, alert.alertType)

    // 显示Toast通知
    const toastMessage = `${alert.message}`

    switch (alert.alertType) {
      case 'limit_up':
        toast.success(toastMessage, { duration: 5000 })
        break
      case 'limit_down':
        toast.error(toastMessage, { duration: 5000 })
        break
      case 'price_change':
        if (alert.changePercent > 0) {
          toast.success(toastMessage, { duration: 5000 })
        } else {
          toast.error(toastMessage, { duration: 5000 })
        }
        break
      default:
        toast.info(toastMessage, { duration: 5000 })
    }

    // 发送浏览器桌面通知
    sendBrowserNotification(alert)

    console.log('[RealtimeMonitor] 告警通知已发送:', alert)
  }, [isNotificationInCooldown, markNotificationSent, sendBrowserNotification])

  /**
   * 处理股票行情更新 - 状态机版本
   */
  const handleStockUpdate = useCallback(
    (quote: RealtimeQuote) => {
      // 1. 添加数据到时间窗口 (用于成交量增量计算)
      timeWindowManagerRef.current.addDataPoint(quote.tsCode, quote)

      // 2. 存储到盘中历史数据 (用于当天数据查询和分析)
      intradayHistoryManagerRef.current.addDataPoint(quote)

      // 3. 获取该股票的监控规则
      const stockRules = monitorRules.filter((rule) => rule.stockCode === quote.tsCode && rule.enabled)

      if (stockRules.length === 0) {
        return
      }

      // 4. 获取上一次行情数据
      const previousQuote = previousQuotesRef.current.get(quote.tsCode)

      // 5. 遍历每条规则,进行状态机检查
      for (const rule of stockRules) {
        const alertKey = `${quote.tsCode}:${rule.ruleType}`
        const currentState = alertStatesRef.current.get(alertKey)

        // 6. 准备规则检查参数
        const rules = [
          {
            ruleType: rule.ruleType,
            config: rule.config,
            currentAlertState: currentState,
          },
        ]

        // 7. 执行规则检查
        const checkResults = checkAllRules(quote, previousQuote, rules, timeWindowManagerRef.current)

        // 8. 处理检查结果
        const result = checkResults[0]?.result

        if (!result) {
          continue
        }

        // 9. 状态转换逻辑
        if (result.shouldOpen && result.alertData) {
          // 告警打开: 创建新的 OPEN 状态
          const newState: AlertState = {
            status: 'OPEN',
            openTime: Date.now(),
            lastCheckTime: Date.now(),
            triggerData: result.alertData,
          }
          alertStatesRef.current.set(alertKey, newState)

          // 发送通知 (仅在 OPEN 时发送)
          sendAlertNotification(result.alertData)

          console.log(`[RealtimeMonitor] 告警打开: ${alertKey}`, result.alertData)
        } else if (result.shouldClose) {
          // 告警关闭: 删除状态
          if (currentState) {
            alertStatesRef.current.delete(alertKey)
            console.log(`[RealtimeMonitor] 告警关闭: ${alertKey}`)
          }
        } else if (currentState && currentState.status === 'OPEN') {
          // 保持活跃: OPEN -> ACTIVE (不再发送通知)
          currentState.status = 'ACTIVE'
          currentState.lastCheckTime = Date.now()
        } else if (currentState && currentState.status === 'ACTIVE') {
          // 更新检查时间
          currentState.lastCheckTime = Date.now()
        }
      }

      // 10. 更新上一次行情数据
      previousQuotesRef.current.set(quote.tsCode, quote)
    },
    [monitorRules, sendAlertNotification]
  )

  /**
   * 监听WebSocket股票更新
   */
  useEffect(() => {
    if (!client || !isConnected) {
      return
    }

    // 注册股票更新监听器
    client.on<RealtimeQuote>('stock_update', handleStockUpdate)

    // 定期清理过期的通知冷却记录（每分钟）
    const cleanupInterval = setInterval(cleanupExpiredCooldowns, 60 * 1000)

    // 定期输出内存统计（每5分钟）
    const memoryStatsInterval = setInterval(() => {
      const timeWindowStats = timeWindowManagerRef.current.getMemoryUsage()
      const historyStats = intradayHistoryManagerRef.current.getStats()
      console.log('[RealtimeMonitor] 内存统计:', {
        时间窗口: {
          监控股票数: timeWindowStats.stockCount,
          数据点总数: timeWindowStats.totalDataPoints,
          估算内存: `${(timeWindowStats.estimatedBytes / 1024).toFixed(2)} KB`,
          平均点数每股: timeWindowStats.averagePointsPerStock.toFixed(0),
        },
        盘中历史: {
          股票数: historyStats.stockCount,
          数据点总数: historyStats.totalDataPoints,
          估算内存: `${historyStats.estimatedMemoryMB.toFixed(2)} MB`,
        },
        活跃告警数: alertStatesRef.current.size,
      })
    }, 5 * 60 * 1000)

    console.log('[RealtimeMonitor] 实时监控引擎已启动 (状态机模式)')

    return () => {
      client.off('stock_update', handleStockUpdate)
      clearInterval(cleanupInterval)
      clearInterval(memoryStatsInterval)
      // 清理历史数据管理器的定时器
      intradayHistoryManagerRef.current.destroy()
      console.log('[RealtimeMonitor] 实时监控引擎已停止')
    }
  }, [client, isConnected, handleStockUpdate, cleanupExpiredCooldowns])

  /**
   * 初始化时请求通知权限
   */
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission)
    }
  }, [])

  /**
   * 获取活跃告警列表 (用于UI展示)
   */
  const getActiveAlerts = useCallback((): Array<{ alertKey: string; state: AlertState }> => {
    const activeAlerts: Array<{ alertKey: string; state: AlertState }> = []
    alertStatesRef.current.forEach((state, key) => {
      activeAlerts.push({ alertKey: key, state })
    })
    return activeAlerts
  }, [])

  return {
    notificationPermission,
    requestNotificationPermission,
    getActiveAlerts,
  }
}
