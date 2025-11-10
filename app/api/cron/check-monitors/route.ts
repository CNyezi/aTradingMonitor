/**
 * 监控规则检查 Cron Job
 * 频率: 每1分钟
 * 权限: Vercel Cron Secret 验证
 *
 * 功能:
 * 1. 获取所有启用的监控规则
 * 2. 对每个规则执行检查逻辑
 * 3. 如触发条件则创建告警记录
 * 4. 触发通知 (Webhook/Web Push)
 */

import { db } from '@/lib/db'
import { stockMonitorRules, stockAlerts, stocks, userNotificationSettings, userWatchedStocks } from '@/lib/db/schema'
import { checkRule, type MonitorRuleConfig } from '@/lib/monitors/check-rules'
import { sendWebhookNotification, type WebhookPayload } from '@/lib/notifications/webhook'
import { sendWebPushNotification, type PushSubscription } from '@/lib/notifications/web-push'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

// Vercel Cron Secret 验证
function verifyCronSecret(request: Request): boolean {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.warn('[Cron] CRON_SECRET not configured')
    return false
  }

  if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[Cron] Invalid authorization header')
    return false
  }

  return true
}

/**
 * 检查是否在交易时间内
 */
function isWithinTradingHours(): boolean {
  const now = new Date()
  const day = now.getDay()

  if (day === 0 || day === 6) {
    return false
  }

  const bjTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }))
  const hours = bjTime.getHours()
  const minutes = bjTime.getMinutes()
  const timeInMinutes = hours * 60 + minutes

  const morningStart = 9 * 60 + 30
  const morningEnd = 11 * 60 + 30
  const afternoonStart = 13 * 60
  const afternoonEnd = 15 * 60

  return (
    (timeInMinutes >= morningStart && timeInMinutes <= morningEnd) ||
    (timeInMinutes >= afternoonStart && timeInMinutes <= afternoonEnd)
  )
}

/**
 * 创建告警记录并发送通知
 */
async function createAlertAndNotify(
  userId: string,
  stockId: string,
  stockCode: string,
  stockName: string,
  alertType: 'price_change' | 'volume_spike' | 'limit_up' | 'limit_down' | 'price_breakout',
  triggerData: any
) {
  try {
    // 1. 创建告警记录
    await db.insert(stockAlerts).values({
      userId,
      stockId,
      alertType,
      triggerTime: new Date(triggerData.triggerTime),
      triggerData,
      read: false,
      notified: false,
      createdAt: new Date(),
    })

    // 2. 获取用户的通知设置
    const [settings] = await db
      .select()
      .from(userNotificationSettings)
      .where(eq(userNotificationSettings.userId, userId))
      .limit(1)

    if (!settings) {
      console.log(`[Cron] No notification settings for user ${userId}`)
      return true
    }

    // 3. 准备通知内容
    const payload: WebhookPayload = {
      alertType,
      stockCode,
      stockName,
      triggerData,
      timestamp: new Date().toISOString(),
      message: '',
    }

    // 4. 发送 Webhook 通知
    if (settings.webhookEnabled && settings.webhookUrl) {
      const webhookSuccess = await sendWebhookNotification(settings.webhookUrl, payload)
      console.log(`[Cron] Webhook notification ${webhookSuccess ? 'sent' : 'failed'}: ${stockName}`)
    }

    // 5. 发送 Web Push 通知
    if (settings.browserPushEnabled && settings.pushSubscription) {
      const subscription = settings.pushSubscription as unknown as PushSubscription
      const pushSuccess = await sendWebPushNotification(subscription, alertType, stockCode, stockName, triggerData)
      console.log(`[Cron] Web Push notification ${pushSuccess ? 'sent' : 'failed'}: ${stockName}`)
    }

    // 6. 更新告警为已通知
    await db
      .update(stockAlerts)
      .set({ notified: true })
      .where(eq(stockAlerts.userId, userId))
      .where(eq(stockAlerts.stockId, stockId))
      .where(eq(stockAlerts.createdAt, new Date()))

    return true
  } catch (error) {
    console.error('[Cron] Failed to create alert and notify:', error)
    return false
  }
}

export async function GET(request: Request) {
  try {
    // 1. 验证 Cron Secret
    if (!verifyCronSecret(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. 检查是否在交易时间内
    if (!isWithinTradingHours()) {
      console.log('[Cron] Not within trading hours, skipping monitors...')
      return NextResponse.json({
        success: true,
        message: 'Not within trading hours',
        skipped: true,
      })
    }

    console.log('[Cron] Starting monitor checks...')

    // 3. 获取所有启用的监控规则
    const enabledRules = await db
      .select({
        id: stockMonitorRules.id,
        userId: stockMonitorRules.userId,
        ruleType: stockMonitorRules.ruleType,
        config: stockMonitorRules.config,
      })
      .from(stockMonitorRules)
      .where(eq(stockMonitorRules.enabled, true))

    if (enabledRules.length === 0) {
      console.log('[Cron] No enabled monitor rules found')
      return NextResponse.json({
        success: true,
        message: 'No enabled monitor rules',
        checked: 0,
        triggered: 0,
      })
    }

    // 4. 获取所有用户的开启监控的股票
    const monitoredStocks = await db
      .select({
        userId: userWatchedStocks.userId,
        stockId: userWatchedStocks.stockId,
        tsCode: stocks.tsCode,
        stockName: stocks.name,
      })
      .from(userWatchedStocks)
      .innerJoin(stocks, eq(userWatchedStocks.stockId, stocks.id))
      .where(eq(userWatchedStocks.monitored, true))

    if (monitoredStocks.length === 0) {
      console.log('[Cron] No monitored stocks found')
      return NextResponse.json({
        success: true,
        message: 'No monitored stocks',
        checked: 0,
        triggered: 0,
      })
    }

    console.log(`[Cron] Checking ${enabledRules.length} rules x ${monitoredStocks.length} stocks...`)

    // 5. 对每个用户的每只监控股票执行所有规则检查
    let checkedCount = 0
    let triggeredCount = 0

    for (const stock of monitoredStocks) {
      // 找到该用户的所有启用规则
      const userRules = enabledRules.filter((r) => r.userId === stock.userId)

      for (const rule of userRules) {
        try {
          const config = rule.config as unknown as MonitorRuleConfig
          const triggerData = await checkRule(rule.ruleType, stock.stockId, config)

          checkedCount++

          if (triggerData) {
            // 触发条件满足，创建告警并发送通知
            const created = await createAlertAndNotify(
              stock.userId,
              stock.stockId,
              stock.tsCode,
              stock.stockName,
              rule.ruleType,
              triggerData
            )

            if (created) {
              triggeredCount++
              console.log(
                `[Cron] Alert triggered: ${stock.stockName} (${stock.tsCode}) - ${rule.ruleType} - ${JSON.stringify(triggerData)}`
              )
            }
          }
        } catch (error) {
          console.error(`[Cron] Failed to check rule ${rule.id} for stock ${stock.stockId}:`, error)
        }
      }
    }

    console.log(`[Cron] Monitor checks completed: ${checkedCount} checked, ${triggeredCount} triggered`)

    return NextResponse.json({
      success: true,
      message: 'Monitor checks completed',
      checked: checkedCount,
      triggered: triggeredCount,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Cron] Monitor checks failed:', error)
    return NextResponse.json(
      {
        error: 'Monitor checks failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
