import type { ConnectionManager } from '../managers/connection-manager'
import type { SubscriptionManager } from '../managers/subscription-manager'
import type { ClientMessage } from '../types'

/**
 * 消息路由器
 * 负责处理客户端发送的各种消息类型
 */
export class MessageRouter {
  constructor(
    private subscriptionManager: SubscriptionManager,
    private connectionManager: ConnectionManager
  ) {}

  /**
   * 处理客户端消息
   */
  handleMessage(userId: string, message: ClientMessage): void {
    try {
      switch (message.type) {
        case 'subscribe_stocks':
          this.handleSubscribeStocks(userId, message.payload.tsCodes)
          break

        case 'unsubscribe_stocks':
          this.handleUnsubscribeStocks(userId, message.payload.tsCodes)
          break

        case 'ping':
          this.handlePing(userId)
          break

        default:
          console.warn(`[MessageRouter] 未知的消息类型:`, message)
          this.connectionManager.sendToUser(userId, {
            type: 'error',
            payload: { message: '未知的消息类型' },
          })
      }
    } catch (error) {
      console.error('[MessageRouter] 处理消息失败:', error)
      this.connectionManager.sendToUser(userId, {
        type: 'error',
        payload: { message: '处理消息失败' },
      })
    }
  }

  /**
   * 处理订阅股票请求
   */
  private handleSubscribeStocks(userId: string, tsCodes: string[]): void {
    if (!Array.isArray(tsCodes) || tsCodes.length === 0) {
      this.connectionManager.sendToUser(userId, {
        type: 'error',
        payload: { message: '股票代码列表不能为空' },
      })
      return
    }

    // 验证股票代码格式（简单验证）
    const validTsCodes = tsCodes.filter((code) => {
      return typeof code === 'string' && /^\d{6}\.(SH|SZ)$/.test(code)
    })

    if (validTsCodes.length === 0) {
      this.connectionManager.sendToUser(userId, {
        type: 'error',
        payload: { message: '无效的股票代码格式' },
      })
      return
    }

    // 添加订阅
    this.subscriptionManager.subscribe(userId, validTsCodes)

    console.log(`[MessageRouter] 用户 ${userId} 订阅了 ${validTsCodes.length} 只股票`)
  }

  /**
   * 处理取消订阅请求
   */
  private handleUnsubscribeStocks(userId: string, tsCodes: string[]): void {
    if (!Array.isArray(tsCodes) || tsCodes.length === 0) {
      this.connectionManager.sendToUser(userId, {
        type: 'error',
        payload: { message: '股票代码列表不能为空' },
      })
      return
    }

    // 取消订阅
    this.subscriptionManager.unsubscribe(userId, tsCodes)

    console.log(`[MessageRouter] 用户 ${userId} 取消订阅了 ${tsCodes.length} 只股票`)
  }

  /**
   * 处理ping请求
   */
  private handlePing(userId: string): void {
    this.connectionManager.sendToUser(userId, {
      type: 'pong',
    })
  }
}
