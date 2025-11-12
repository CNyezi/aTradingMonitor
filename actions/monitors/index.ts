/**
 * 监控规则管理 Server Actions
 */

'use server'

import { db } from '@/lib/db'
import {
  stockMonitorRules,
  stocks,
  stockAlerts,
  userWatchedStocks,
  stockMonitorRuleAssociations
} from '@/lib/db/schema'
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

/**
 * 获取股票关联的规则列表
 */
export async function getStockRules(watchedStockId: string) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.id) {
    return actionResponse.unauthorized()
  }

  try {
    // 验证股票所有权
    const [stock] = await db
      .select()
      .from(userWatchedStocks)
      .where(
        and(
          eq(userWatchedStocks.id, watchedStockId),
          eq(userWatchedStocks.userId, session.user.id)
        )
      )

    if (!stock) {
      return actionResponse.error('Stock not found')
    }

    // 获取关联的规则
    const associations = await db
      .select({
        associationId: stockMonitorRuleAssociations.id,
        ruleId: stockMonitorRuleAssociations.ruleId,
        enabled: stockMonitorRuleAssociations.enabled,
        rule: stockMonitorRules,
      })
      .from(stockMonitorRuleAssociations)
      .innerJoin(
        stockMonitorRules,
        eq(stockMonitorRuleAssociations.ruleId, stockMonitorRules.id)
      )
      .where(eq(stockMonitorRuleAssociations.watchedStockId, watchedStockId))

    return actionResponse.success({ associations })
  } catch (error) {
    console.error('Failed to get stock rules:', error)
    return actionResponse.error('Failed to get stock rules')
  }
}

/**
 * 为股票添加规则关联
 */
export async function addStockRule(params: {
  watchedStockId: string
  ruleId: string
  enabled?: boolean
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.id) {
    return actionResponse.unauthorized()
  }

  try {
    // 验证股票和规则所有权
    const [stock] = await db
      .select()
      .from(userWatchedStocks)
      .where(
        and(
          eq(userWatchedStocks.id, params.watchedStockId),
          eq(userWatchedStocks.userId, session.user.id)
        )
      )

    const [rule] = await db
      .select()
      .from(stockMonitorRules)
      .where(
        and(
          eq(stockMonitorRules.id, params.ruleId),
          eq(stockMonitorRules.userId, session.user.id)
        )
      )

    if (!stock || !rule) {
      return actionResponse.error('Stock or rule not found')
    }

    // 创建关联（使用 upsert 避免重复）
    await db
      .insert(stockMonitorRuleAssociations)
      .values({
        userId: session.user.id,
        watchedStockId: params.watchedStockId,
        ruleId: params.ruleId,
        enabled: params.enabled ?? true,
      })
      .onConflictDoUpdate({
        target: [
          stockMonitorRuleAssociations.watchedStockId,
          stockMonitorRuleAssociations.ruleId,
        ],
        set: { enabled: params.enabled ?? true },
      })

    return actionResponse.success({ message: 'Rule association added successfully' })
  } catch (error) {
    console.error('Failed to add stock rule:', error)
    return actionResponse.error('Failed to add stock rule')
  }
}

/**
 * 移除股票的规则关联
 */
export async function removeStockRule(params: {
  watchedStockId: string
  ruleId: string
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.id) {
    return actionResponse.unauthorized()
  }

  try {
    await db
      .delete(stockMonitorRuleAssociations)
      .where(
        and(
          eq(stockMonitorRuleAssociations.watchedStockId, params.watchedStockId),
          eq(stockMonitorRuleAssociations.ruleId, params.ruleId),
          eq(stockMonitorRuleAssociations.userId, session.user.id)
        )
      )

    return actionResponse.success({ message: 'Rule association removed successfully' })
  } catch (error) {
    console.error('Failed to remove stock rule:', error)
    return actionResponse.error('Failed to remove stock rule')
  }
}

/**
 * 批量为股票添加规则
 */
export async function bulkAddStockRules(params: {
  watchedStockIds: string[]
  ruleIds: string[]
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.id) {
    return actionResponse.unauthorized()
  }

  try {
    // 验证所有股票的所有权
    const stocks = await db
      .select()
      .from(userWatchedStocks)
      .where(
        and(
          eq(userWatchedStocks.userId, session.user.id)
        )
      )

    const validStockIds = stocks.map(s => s.id)
    const stockIdsToAdd = params.watchedStockIds.filter(id => validStockIds.includes(id))

    if (stockIdsToAdd.length === 0) {
      return actionResponse.error('No valid stocks found')
    }

    // 验证所有规则的所有权
    const rules = await db
      .select()
      .from(stockMonitorRules)
      .where(
        and(
          eq(stockMonitorRules.userId, session.user.id)
        )
      )

    const validRuleIds = rules.map(r => r.id)
    const ruleIdsToAdd = params.ruleIds.filter(id => validRuleIds.includes(id))

    if (ruleIdsToAdd.length === 0) {
      return actionResponse.error('No valid rules found')
    }

    const associations = []
    for (const stockId of stockIdsToAdd) {
      for (const ruleId of ruleIdsToAdd) {
        associations.push({
          userId: session.user.id,
          watchedStockId: stockId,
          ruleId: ruleId,
          enabled: true,
        })
      }
    }

    await db
      .insert(stockMonitorRuleAssociations)
      .values(associations)
      .onConflictDoUpdate({
        target: [
          stockMonitorRuleAssociations.watchedStockId,
          stockMonitorRuleAssociations.ruleId,
        ],
        set: { enabled: true },
      })

    return actionResponse.success({
      message: `Successfully added ${associations.length} rule associations`,
      count: associations.length
    })
  } catch (error) {
    console.error('Failed to bulk add stock rules:', error)
    return actionResponse.error('Failed to bulk add stock rules')
  }
}

/**
 * 为规则添加股票关联（规则侧操作）
 */
export async function addRuleStocks(params: {
  ruleId: string
  watchedStockIds: string[]
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.id) {
    return actionResponse.unauthorized()
  }

  try {
    // 验证规则所有权
    const [rule] = await db
      .select()
      .from(stockMonitorRules)
      .where(
        and(
          eq(stockMonitorRules.id, params.ruleId),
          eq(stockMonitorRules.userId, session.user.id)
        )
      )

    if (!rule) {
      return actionResponse.error('Rule not found')
    }

    // 验证所有股票的所有权
    const stocks = await db
      .select()
      .from(userWatchedStocks)
      .where(
        and(
          eq(userWatchedStocks.userId, session.user.id)
        )
      )

    const validStockIds = stocks.map(s => s.id)
    const stockIdsToAdd = params.watchedStockIds.filter(id => validStockIds.includes(id))

    if (stockIdsToAdd.length === 0) {
      return actionResponse.error('No valid stocks found')
    }

    const associations = stockIdsToAdd.map(stockId => ({
      userId: session.user.id!,
      watchedStockId: stockId,
      ruleId: params.ruleId,
      enabled: true,
    }))

    await db
      .insert(stockMonitorRuleAssociations)
      .values(associations)
      .onConflictDoUpdate({
        target: [
          stockMonitorRuleAssociations.watchedStockId,
          stockMonitorRuleAssociations.ruleId,
        ],
        set: { enabled: true },
      })

    return actionResponse.success({
      message: `Successfully added ${associations.length} stock associations to rule`,
      count: associations.length
    })
  } catch (error) {
    console.error('Failed to add rule stocks:', error)
    return actionResponse.error('Failed to add rule stocks')
  }
}

/**
 * 获取规则关联的股票列表
 */
export async function getRuleStocks(ruleId: string) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.id) {
    return actionResponse.unauthorized()
  }

  try {
    const associations = await db
      .select({
        associationId: stockMonitorRuleAssociations.id,
        watchedStockId: stockMonitorRuleAssociations.watchedStockId,
        enabled: stockMonitorRuleAssociations.enabled,
        stock: {
          id: userWatchedStocks.id,
          monitored: userWatchedStocks.monitored,
          stockId: userWatchedStocks.stockId,
        },
        stockInfo: stocks,
      })
      .from(stockMonitorRuleAssociations)
      .innerJoin(
        userWatchedStocks,
        eq(stockMonitorRuleAssociations.watchedStockId, userWatchedStocks.id)
      )
      .innerJoin(stocks, eq(userWatchedStocks.stockId, stocks.id))
      .where(
        and(
          eq(stockMonitorRuleAssociations.ruleId, ruleId),
          eq(stockMonitorRuleAssociations.userId, session.user.id)
        )
      )

    return actionResponse.success({ associations })
  } catch (error) {
    console.error('Failed to get rule stocks:', error)
    return actionResponse.error('Failed to get rule stocks')
  }
}

/**
 * 切换股票规则关联的启用状态
 */
export async function toggleStockRuleEnabled(params: {
  watchedStockId: string
  ruleId: string
  enabled: boolean
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.id) {
    return actionResponse.unauthorized()
  }

  try {
    await db
      .update(stockMonitorRuleAssociations)
      .set({ enabled: params.enabled })
      .where(
        and(
          eq(stockMonitorRuleAssociations.watchedStockId, params.watchedStockId),
          eq(stockMonitorRuleAssociations.ruleId, params.ruleId),
          eq(stockMonitorRuleAssociations.userId, session.user.id)
        )
      )

    return actionResponse.success({
      message: `Rule association ${params.enabled ? 'enabled' : 'disabled'} successfully`
    })
  } catch (error) {
    console.error('Failed to toggle stock rule enabled:', error)
    return actionResponse.error('Failed to toggle stock rule enabled')
  }
}
