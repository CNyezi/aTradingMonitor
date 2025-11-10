/**
 * Web Push 通知服务
 * 使用 Web Push API 向用户浏览器推送通知
 */

import webpush from 'web-push'
import type { AlertTriggerData } from '@/lib/monitors/check-rules'

// 初始化 VAPID keys (需要在环境变量中配置)
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || ''
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || ''
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:noreply@example.com'

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)
}

export interface PushSubscription {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

export interface PushNotificationPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  data?: any
  tag?: string
  requireInteraction?: boolean
}

/**
 * 格式化告警为 Push 通知内容
 */
function formatAlertToPushNotification(
  alertType: string,
  stockCode: string,
  stockName: string,
  triggerData: AlertTriggerData
): PushNotificationPayload {
  let title = ''
  let body = ''

  switch (alertType) {
    case 'price_change':
      title = `${stockName} 价格异动`
      body = `当前价格 ¥${triggerData.currentPrice}, 涨跌幅 ${triggerData.changePercent! > 0 ? '+' : ''}${triggerData.changePercent}%`
      break

    case 'volume_spike':
      title = `${stockName} 成交量异动`
      body = `成交量激增 ${triggerData.volumeMultiplier?.toFixed(2)}倍, 当前价格 ¥${triggerData.currentPrice}`
      break

    case 'limit_up':
      title = `⚠️ ${stockName} 涨停预警`
      body = `当前涨幅 +${triggerData.changePercent}%, 价格 ¥${triggerData.currentPrice}`
      break

    case 'limit_down':
      title = `⚠️ ${stockName} 跌停预警`
      body = `当前跌幅 ${triggerData.changePercent}%, 价格 ¥${triggerData.currentPrice}`
      break

    case 'price_breakout':
      title = `${stockName} 价格突破`
      body = `突破价格 ¥${triggerData.breakoutPrice}, 当前 ¥${triggerData.currentPrice}`
      break

    default:
      title = `${stockName} 告警`
      body = `请查看详情`
  }

  return {
    title,
    body,
    icon: '/icon-192.png', // 需要在 public 目录下准备图标
    badge: '/badge-72.png',
    tag: `stock-alert-${stockCode}-${Date.now()}`,
    requireInteraction: true, // 要求用户交互才关闭
    data: {
      alertType,
      stockCode,
      stockName,
      triggerData,
      url: `/dashboard/my-stocks`, // 点击通知时跳转的URL
    },
  }
}

/**
 * 发送 Web Push 通知
 */
export async function sendWebPushNotification(
  subscription: PushSubscription,
  alertType: string,
  stockCode: string,
  stockName: string,
  triggerData: AlertTriggerData
): Promise<boolean> {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn('[WebPush] VAPID keys not configured')
    return false
  }

  try {
    const payload = formatAlertToPushNotification(alertType, stockCode, stockName, triggerData)

    await webpush.sendNotification(subscription, JSON.stringify(payload))

    console.log(`[WebPush] Notification sent successfully: ${stockName}`)
    return true
  } catch (error) {
    console.error('[WebPush] Failed to send notification:', error)

    // 如果订阅失效 (410 Gone), 返回 false 以便调用方删除该订阅
    if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 410) {
      console.warn('[WebPush] Subscription expired (410 Gone)')
      return false
    }

    return false
  }
}

/**
 * 批量发送 Web Push 通知
 */
export async function sendBatchWebPushNotifications(
  subscriptions: PushSubscription[],
  alertType: string,
  stockCode: string,
  stockName: string,
  triggerData: AlertTriggerData
): Promise<{ sent: number; failed: number; expired: PushSubscription[] }> {
  const expired: PushSubscription[] = []
  let sent = 0
  let failed = 0

  for (const subscription of subscriptions) {
    try {
      const success = await sendWebPushNotification(subscription, alertType, stockCode, stockName, triggerData)

      if (success) {
        sent++
      } else {
        // 检查是否是订阅失效
        expired.push(subscription)
        failed++
      }
    } catch (error) {
      console.error('[WebPush] Failed to send to subscription:', error)
      failed++
    }
  }

  return { sent, failed, expired }
}

/**
 * 生成 VAPID keys (仅用于初始化配置)
 * 运行一次后将 keys 保存到环境变量中
 */
export function generateVAPIDKeys() {
  const keys = webpush.generateVAPIDKeys()
  console.log('VAPID Public Key:', keys.publicKey)
  console.log('VAPID Private Key:', keys.privateKey)
  return keys
}

/**
 * 获取 VAPID Public Key (供前端使用)
 */
export function getVAPIDPublicKey(): string {
  return vapidPublicKey
}
