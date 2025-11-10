/**
 * Webhook 通知服务
 * 支持自定义 Webhook URL (如企业微信、钉钉、Slack等)
 */

import type { AlertTriggerData } from '@/lib/monitors/check-rules'

export interface WebhookPayload {
  alertType: 'price_change' | 'volume_spike' | 'limit_up' | 'limit_down' | 'price_breakout'
  stockCode: string
  stockName: string
  triggerData: AlertTriggerData
  timestamp: string
  message: string
}

/**
 * 格式化告警消息 (适用于企业微信/钉钉等)
 */
function formatAlertMessage(payload: WebhookPayload): string {
  const { alertType, stockCode, stockName, triggerData } = payload

  let message = `📊 股票监控告警\n\n`
  message += `股票: ${stockName} (${stockCode})\n`
  message += `时间: ${new Date(triggerData.triggerTime).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n`
  message += `类型: ${getAlertTypeLabel(alertType)}\n\n`

  switch (alertType) {
    case 'price_change':
      message += `当前价格: ¥${triggerData.currentPrice}\n`
      message += `涨跌幅: ${triggerData.changePercent! > 0 ? '+' : ''}${triggerData.changePercent}%\n`
      break

    case 'volume_spike':
      message += `当前价格: ¥${triggerData.currentPrice}\n`
      message += `当前成交量: ${triggerData.currentVolume}\n`
      message += `平均成交量: ${triggerData.avgVolume}\n`
      message += `异动倍数: ${triggerData.volumeMultiplier?.toFixed(2)}倍\n`
      break

    case 'limit_up':
      message += `当前价格: ¥${triggerData.currentPrice}\n`
      message += `涨幅: +${triggerData.changePercent}%\n`
      message += `⚠️ 涨停预警!\n`
      break

    case 'limit_down':
      message += `当前价格: ¥${triggerData.currentPrice}\n`
      message += `跌幅: ${triggerData.changePercent}%\n`
      message += `⚠️ 跌停预警!\n`
      break

    case 'price_breakout':
      message += `当前价格: ¥${triggerData.currentPrice}\n`
      message += `突破价格: ¥${triggerData.breakoutPrice}\n`
      message += `涨跌幅: ${triggerData.changePercent! > 0 ? '+' : ''}${triggerData.changePercent}%\n`
      break
  }

  return message
}

/**
 * 获取告警类型标签
 */
function getAlertTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    price_change: '价格异动',
    volume_spike: '成交量异动',
    limit_up: '涨停',
    limit_down: '跌停',
    price_breakout: '价格突破',
  }
  return labels[type] || type
}

/**
 * 发送企业微信群机器人通知
 * 文档: https://developer.work.weixin.qq.com/document/path/91770
 */
async function sendWeComWebhook(webhookUrl: string, payload: WebhookPayload): Promise<boolean> {
  try {
    const message = formatAlertMessage(payload)

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        msgtype: 'text',
        text: {
          content: message,
        },
      }),
    })

    const result = await response.json()
    return result.errcode === 0
  } catch (error) {
    console.error('[Webhook] Failed to send WeCom webhook:', error)
    return false
  }
}

/**
 * 发送钉钉群机器人通知
 * 文档: https://open.dingtalk.com/document/robots/custom-robot-access
 */
async function sendDingTalkWebhook(webhookUrl: string, payload: WebhookPayload): Promise<boolean> {
  try {
    const message = formatAlertMessage(payload)

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        msgtype: 'text',
        text: {
          content: message,
        },
      }),
    })

    const result = await response.json()
    return result.errcode === 0
  } catch (error) {
    console.error('[Webhook] Failed to send DingTalk webhook:', error)
    return false
  }
}

/**
 * 发送通用 Webhook (JSON格式)
 */
async function sendGenericWebhook(webhookUrl: string, payload: WebhookPayload): Promise<boolean> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...payload,
        message: formatAlertMessage(payload),
      }),
    })

    return response.ok
  } catch (error) {
    console.error('[Webhook] Failed to send generic webhook:', error)
    return false
  }
}

/**
 * 智能检测并发送 Webhook
 * 根据 URL 自动判断是企业微信、钉钉还是通用 Webhook
 */
export async function sendWebhookNotification(webhookUrl: string, payload: WebhookPayload): Promise<boolean> {
  if (!webhookUrl) {
    console.warn('[Webhook] Webhook URL is empty')
    return false
  }

  // 企业微信
  if (webhookUrl.includes('qyapi.weixin.qq.com')) {
    return sendWeComWebhook(webhookUrl, payload)
  }

  // 钉钉
  if (webhookUrl.includes('oapi.dingtalk.com')) {
    return sendDingTalkWebhook(webhookUrl, payload)
  }

  // 通用 Webhook
  return sendGenericWebhook(webhookUrl, payload)
}
