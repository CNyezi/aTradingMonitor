/**
 * 监控规则管理 Server Actions
 */

'use server'

import { db } from '@/lib/db'
import { stockMonitorRules, stocks, stockAlerts, userWatchedStocks } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { actionResponse } from '@/lib/action-response'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import type { MonitorRuleConfig } from '@/lib/monitors/check-rules'

/**
 * 获取用户的所有监控规则
 */
export async function getUserMonitorRules() {
  try {
    const session = await auth.api.getSession({ headers: await headers() })

    if (!session?.user?.id) {
      return actionResponse.unauthorized()
    }

    const rules = await db
      .select({
        id: stockMonitorRules.id,
        ruleType: stockMonitorRules.ruleType,
        ruleName: stockMonitorRules.ruleName,
        enabled: stockMonitorRules.enabled,
        config: stockMonitorRules.config,
        createdAt: stockMonitorRules.createdAt,
        updatedAt: stockMonitorRules.updatedAt,
      })
      .from(stockMonitorRules)
      .where(eq(stockMonitorRules.userId, session.user.id))
      .orderBy(desc(stockMonitorRules.createdAt))

    return actionResponse.success({ rules })
  } catch (error) {
    console.error('[Actions] Failed to get monitor rules:', error)
    return actionResponse.error('Failed to get monitor rules')
  }
}

/**
 * 创建监控规则（全局规则，应用到所有开启监控的股票）
 */
export async function createMonitorRule(params: {
  ruleType: 'price_change' | 'volume_spike' | 'limit_up' | 'limit_down' | 'price_breakout'
  ruleName?: string
  config: MonitorRuleConfig
  enabled?: boolean
}) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })

    if (!session?.user?.id) {
      return actionResponse.unauthorized()
    }

    // 创建规则
    const [rule] = await db
      .insert(stockMonitorRules)
      .values({
        userId: session.user.id,
        ruleType: params.ruleType,
        ruleName: params.ruleName,
        enabled: params.enabled ?? true,
        config: params.config,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()

    return actionResponse.success({ rule })
  } catch (error) {
    console.error('[Actions] Failed to create monitor rule:', error)
    return actionResponse.error('Failed to create monitor rule')
  }
}

/**
 * 更新监控规则
 */
export async function updateMonitorRule(params: {
  ruleId: string
  config?: MonitorRuleConfig
  enabled?: boolean
}) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })

    if (!session?.user?.id) {
      return actionResponse.unauthorized()
    }

    // 验证规则所有权
    const [existingRule] = await db
      .select()
      .from(stockMonitorRules)
      .where(and(eq(stockMonitorRules.id, params.ruleId), eq(stockMonitorRules.userId, session.user.id)))
      .limit(1)

    if (!existingRule) {
      return actionResponse.error('Rule not found or unauthorized')
    }

    // 更新规则
    const updateData: any = {
      updatedAt: new Date(),
    }

    if (params.config !== undefined) {
      updateData.config = params.config
    }

    if (params.enabled !== undefined) {
      updateData.enabled = params.enabled
    }

    const [rule] = await db.update(stockMonitorRules).set(updateData).where(eq(stockMonitorRules.id, params.ruleId)).returning()

    return actionResponse.success({ rule })
  } catch (error) {
    console.error('[Actions] Failed to update monitor rule:', error)
    return actionResponse.error('Failed to update monitor rule')
  }
}

/**
 * 删除监控规则
 */
export async function deleteMonitorRule(ruleId: string) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })

    if (!session?.user?.id) {
      return actionResponse.unauthorized()
    }

    // 验证规则所有权
    const [existingRule] = await db
      .select()
      .from(stockMonitorRules)
      .where(and(eq(stockMonitorRules.id, ruleId), eq(stockMonitorRules.userId, session.user.id)))
      .limit(1)

    if (!existingRule) {
      return actionResponse.error('Rule not found or unauthorized')
    }

    // 删除规则
    await db.delete(stockMonitorRules).where(eq(stockMonitorRules.id, ruleId))

    return actionResponse.success({ message: 'Rule deleted successfully' })
  } catch (error) {
    console.error('[Actions] Failed to delete monitor rule:', error)
    return actionResponse.error('Failed to delete monitor rule')
  }
}

/**
 * 批量启用/禁用监控规则
 */
export async function toggleMonitorRules(params: { ruleIds: string[]; enabled: boolean }) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })

    if (!session?.user?.id) {
      return actionResponse.unauthorized()
    }

    // 更新规则
    await db
      .update(stockMonitorRules)
      .set({
        enabled: params.enabled,
        updatedAt: new Date(),
      })
      .where(and(eq(stockMonitorRules.userId, session.user.id), eq(stockMonitorRules.id, params.ruleIds[0])))

    return actionResponse.success({ message: 'Rules updated successfully' })
  } catch (error) {
    console.error('[Actions] Failed to toggle monitor rules:', error)
    return actionResponse.error('Failed to toggle monitor rules')
  }
}

/**
 * 获取用户的告警列表
 */
export async function getUserAlerts(params?: { read?: boolean; limit?: number; offset?: number }) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })

    if (!session?.user?.id) {
      return actionResponse.unauthorized()
    }

    const conditions = [eq(stockAlerts.userId, session.user.id)]

    if (params?.read !== undefined) {
      conditions.push(eq(stockAlerts.read, params.read))
    }

    const alerts = await db
      .select({
        id: stockAlerts.id,
        stockId: stockAlerts.stockId,
        stockCode: stocks.tsCode,
        stockName: stocks.name,
        alertType: stockAlerts.alertType,
        triggerTime: stockAlerts.triggerTime,
        triggerData: stockAlerts.triggerData,
        read: stockAlerts.read,
        notified: stockAlerts.notified,
        createdAt: stockAlerts.createdAt,
      })
      .from(stockAlerts)
      .innerJoin(stocks, eq(stockAlerts.stockId, stocks.id))
      .where(and(...conditions))
      .orderBy(desc(stockAlerts.triggerTime))
      .limit(params?.limit || 50)
      .offset(params?.offset || 0)

    return actionResponse.success({ alerts })
  } catch (error) {
    console.error('[Actions] Failed to get alerts:', error)
    return actionResponse.error('Failed to get alerts')
  }
}

/**
 * 标记告警为已读
 */
export async function markAlertAsRead(alertId: string) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })

    if (!session?.user?.id) {
      return actionResponse.unauthorized()
    }

    // 验证告警所有权
    const [existingAlert] = await db
      .select()
      .from(stockAlerts)
      .where(and(eq(stockAlerts.id, alertId), eq(stockAlerts.userId, session.user.id)))
      .limit(1)

    if (!existingAlert) {
      return actionResponse.error('Alert not found or unauthorized')
    }

    // 标记为已读
    await db.update(stockAlerts).set({ read: true }).where(eq(stockAlerts.id, alertId))

    return actionResponse.success({ message: 'Alert marked as read' })
  } catch (error) {
    console.error('[Actions] Failed to mark alert as read:', error)
    return actionResponse.error('Failed to mark alert as read')
  }
}

/**
 * 批量标记告警为已读
 */
export async function markAllAlertsAsRead() {
  try {
    const session = await auth.api.getSession({ headers: await headers() })

    if (!session?.user?.id) {
      return actionResponse.unauthorized()
    }

    await db.update(stockAlerts).set({ read: true }).where(eq(stockAlerts.userId, session.user.id))

    return actionResponse.success({ message: 'All alerts marked as read' })
  } catch (error) {
    console.error('[Actions] Failed to mark all alerts as read:', error)
    return actionResponse.error('Failed to mark all alerts as read')
  }
}

/**
 * 切换股票的监控状态
 */
export async function toggleStockMonitoring(params: { watchedStockId: string; monitored: boolean }) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })

    if (!session?.user?.id) {
      return actionResponse.unauthorized()
    }

    // 验证所有权
    const [existingStock] = await db
      .select()
      .from(userWatchedStocks)
      .where(and(eq(userWatchedStocks.id, params.watchedStockId), eq(userWatchedStocks.userId, session.user.id)))
      .limit(1)

    if (!existingStock) {
      return actionResponse.error('Stock not found or unauthorized')
    }

    // 更新监控状态
    await db
      .update(userWatchedStocks)
      .set({ monitored: params.monitored })
      .where(eq(userWatchedStocks.id, params.watchedStockId))

    return actionResponse.success({ message: 'Monitoring status updated' })
  } catch (error) {
    console.error('[Actions] Failed to toggle stock monitoring:', error)
    return actionResponse.error('Failed to toggle stock monitoring')
  }
}

/**
 * 获取用户所有开启监控的股票列表
 */
export async function getMonitoredStocks() {
  try {
    const session = await auth.api.getSession({ headers: await headers() })

    if (!session?.user?.id) {
      return actionResponse.unauthorized()
    }

    const monitoredStocks = await db
      .select({
        id: userWatchedStocks.id,
        stockId: userWatchedStocks.stockId,
        stockCode: stocks.tsCode,
        stockName: stocks.name,
        monitored: userWatchedStocks.monitored,
        addedAt: userWatchedStocks.addedAt,
      })
      .from(userWatchedStocks)
      .innerJoin(stocks, eq(userWatchedStocks.stockId, stocks.id))
      .where(and(eq(userWatchedStocks.userId, session.user.id), eq(userWatchedStocks.monitored, true)))
      .orderBy(desc(userWatchedStocks.addedAt))

    return actionResponse.success({ stocks: monitoredStocks })
  } catch (error) {
    console.error('[Actions] Failed to get monitored stocks:', error)
    return actionResponse.error('Failed to get monitored stocks')
  }
}
