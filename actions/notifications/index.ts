/**
 * 通知设置 Server Actions
 * 管理用户的 Webhook 和 Web Push 通知配置
 */

'use server'

import { db } from '@/lib/db'
import { userNotificationSettings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { actionResponse } from '@/lib/action-response'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'

/**
 * 获取用户的通知设置
 */
export async function getNotificationSettings() {
  try {
    const session = await auth.api.getSession({ headers: await headers() })

    if (!session?.user?.id) {
      return actionResponse.unauthorized()
    }

    const [settings] = await db
      .select()
      .from(userNotificationSettings)
      .where(eq(userNotificationSettings.userId, session.user.id))
      .limit(1)

    if (!settings) {
      // 如果没有设置，创建默认设置
      const [newSettings] = await db
        .insert(userNotificationSettings)
        .values({
          userId: session.user.id,
          webhookEnabled: false,
          browserPushEnabled: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning()

      return actionResponse.success({ settings: newSettings })
    }

    return actionResponse.success({ settings })
  } catch (error) {
    console.error('[Actions] Failed to get notification settings:', error)
    return actionResponse.error('Failed to get notification settings')
  }
}

/**
 * 更新 Webhook 配置
 */
export async function updateWebhookSettings(params: { webhookUrl?: string; enabled: boolean }) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })

    if (!session?.user?.id) {
      return actionResponse.unauthorized()
    }

    // 验证 Webhook URL 格式
    if (params.enabled && params.webhookUrl) {
      try {
        new URL(params.webhookUrl)
      } catch {
        return actionResponse.error('Invalid webhook URL')
      }
    }

    // 更新或插入设置
    const [settings] = await db
      .insert(userNotificationSettings)
      .values({
        userId: session.user.id,
        webhookUrl: params.webhookUrl || null,
        webhookEnabled: params.enabled,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userNotificationSettings.userId,
        set: {
          webhookUrl: params.webhookUrl || null,
          webhookEnabled: params.enabled,
          updatedAt: new Date(),
        },
      })
      .returning()

    return actionResponse.success({ settings })
  } catch (error) {
    console.error('[Actions] Failed to update webhook settings:', error)
    return actionResponse.error('Failed to update webhook settings')
  }
}

/**
 * 更新 Web Push 订阅
 */
export async function updatePushSubscription(params: {
  subscription?: any // PushSubscription 对象
  enabled: boolean
}) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })

    if (!session?.user?.id) {
      return actionResponse.unauthorized()
    }

    // 更新或插入设置
    const [settings] = await db
      .insert(userNotificationSettings)
      .values({
        userId: session.user.id,
        pushSubscription: params.subscription || null,
        browserPushEnabled: params.enabled,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userNotificationSettings.userId,
        set: {
          pushSubscription: params.subscription || null,
          browserPushEnabled: params.enabled,
          updatedAt: new Date(),
        },
      })
      .returning()

    return actionResponse.success({ settings })
  } catch (error) {
    console.error('[Actions] Failed to update push subscription:', error)
    return actionResponse.error('Failed to update push subscription')
  }
}

/**
 * 设置勿扰时间
 */
export async function updateQuietHours(params: { startTime?: string; endTime?: string }) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })

    if (!session?.user?.id) {
      return actionResponse.unauthorized()
    }

    // 验证时间格式 (HH:MM)
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/
    if (params.startTime && !timeRegex.test(params.startTime)) {
      return actionResponse.error('Invalid start time format')
    }
    if (params.endTime && !timeRegex.test(params.endTime)) {
      return actionResponse.error('Invalid end time format')
    }

    // 更新或插入设置
    const [settings] = await db
      .insert(userNotificationSettings)
      .values({
        userId: session.user.id,
        quietHoursStart: params.startTime || null,
        quietHoursEnd: params.endTime || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userNotificationSettings.userId,
        set: {
          quietHoursStart: params.startTime || null,
          quietHoursEnd: params.endTime || null,
          updatedAt: new Date(),
        },
      })
      .returning()

    return actionResponse.success({ settings })
  } catch (error) {
    console.error('[Actions] Failed to update quiet hours:', error)
    return actionResponse.error('Failed to update quiet hours')
  }
}

/**
 * 测试 Webhook 连接
 */
export async function testWebhook(webhookUrl: string) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })

    if (!session?.user?.id) {
      return actionResponse.unauthorized()
    }

    // 验证 URL
    try {
      new URL(webhookUrl)
    } catch {
      return actionResponse.error('Invalid webhook URL')
    }

    // 发送测试消息
    const testPayload = {
      msgtype: 'text',
      text: {
        content: '🔔 这是一条来自 Nexty Trade Monitor 的测试消息\n\n如果您看到这条消息，说明 Webhook 配置成功！',
      },
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload),
    })

    if (!response.ok) {
      return actionResponse.error('Webhook test failed')
    }

    return actionResponse.success({ message: 'Webhook test successful' })
  } catch (error) {
    console.error('[Actions] Failed to test webhook:', error)
    return actionResponse.error('Failed to test webhook')
  }
}
