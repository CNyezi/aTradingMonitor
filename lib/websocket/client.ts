import type {
  ClientMessage,
  ServerMessage,
  MessageHandler,
  WebSocketConfig,
  ConnectionStatus,
} from './types'

/**
 * WebSocket客户端
 * 提供事件发射、自动重连、心跳检测等功能
 */
export class WebSocketClient {
  private ws: WebSocket | null = null
  private config: Required<WebSocketConfig>
  private listeners: Map<string, Set<MessageHandler>> = new Map()
  private reconnectAttempts = 0
  private reconnectTimer: NodeJS.Timeout | null = null
  private heartbeatTimer: NodeJS.Timeout | null = null
  private status: ConnectionStatus = 'disconnected' as ConnectionStatus

  constructor(config: WebSocketConfig) {
    this.config = {
      url: config.url,
      reconnectInterval: config.reconnectInterval ?? 3000,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 10,
      heartbeatInterval: config.heartbeatInterval ?? 30000,
    }
  }

  /**
   * 连接WebSocket
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.warn('[WebSocketClient] 已连接，跳过重复连接')
      return
    }

    this.setStatus('connecting' as ConnectionStatus)

    try {
      this.ws = new WebSocket(this.config.url)

      this.ws.onopen = () => {
        console.log('[WebSocketClient] 连接成功')
        this.setStatus('connected' as ConnectionStatus)
        this.reconnectAttempts = 0
        this.startHeartbeat()
        this.emit('open', undefined)
      }

      this.ws.onmessage = (event) => {
        try {
          const message: ServerMessage = JSON.parse(event.data)
          this.handleMessage(message)
        } catch (error) {
          console.error('[WebSocketClient] 解析消息失败:', error)
        }
      }

      this.ws.onerror = (error) => {
        console.error('[WebSocketClient] 连接错误:', error)
        this.setStatus('error' as ConnectionStatus)
        this.emit('error', error)
      }

      this.ws.onclose = (event) => {
        console.log('[WebSocketClient] 连接关闭:', event.code, event.reason)
        this.setStatus('disconnected' as ConnectionStatus)
        this.stopHeartbeat()
        this.emit('close', { code: event.code, reason: event.reason })

        // 尝试重连（非正常关闭）
        if (event.code !== 1000 && event.code !== 1001) {
          this.scheduleReconnect()
        }
      }
    } catch (error) {
      console.error('[WebSocketClient] 创建连接失败:', error)
      this.setStatus('error' as ConnectionStatus)
      this.scheduleReconnect()
    }
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    this.stopReconnect()
    this.stopHeartbeat()

    if (this.ws) {
      this.ws.close(1000, '客户端主动断开')
      this.ws = null
    }

    this.setStatus('disconnected' as ConnectionStatus)
  }

  /**
   * 发送消息
   */
  send(message: ClientMessage): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[WebSocketClient] 连接未就绪，无法发送消息')
      return false
    }

    try {
      this.ws.send(JSON.stringify(message))
      return true
    } catch (error) {
      console.error('[WebSocketClient] 发送消息失败:', error)
      return false
    }
  }

  /**
   * 订阅股票
   */
  subscribeStocks(tsCodes: string[]): boolean {
    return this.send({
      type: 'subscribe_stocks',
      payload: { tsCodes },
    })
  }

  /**
   * 取消订阅股票
   */
  unsubscribeStocks(tsCodes: string[]): boolean {
    return this.send({
      type: 'unsubscribe_stocks',
      payload: { tsCodes },
    })
  }

  /**
   * 获取当前连接状态
   */
  getStatus(): ConnectionStatus {
    return this.status
  }

  /**
   * 注册事件监听器
   */
  on<T = any>(event: string, handler: MessageHandler<T>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(handler as MessageHandler)
  }

  /**
   * 移除事件监听器
   */
  off<T = any>(event: string, handler: MessageHandler<T>): void {
    const handlers = this.listeners.get(event)
    if (handlers) {
      handlers.delete(handler as MessageHandler)
      if (handlers.size === 0) {
        this.listeners.delete(event)
      }
    }
  }

  /**
   * 移除所有事件监听器
   */
  offAll(event?: string): void {
    if (event) {
      this.listeners.delete(event)
    } else {
      this.listeners.clear()
    }
  }

  /**
   * 获取连接状态
   */
  getStatus(): ConnectionStatus {
    return this.status
  }

  /**
   * 是否已连接
   */
  isConnected(): boolean {
    return this.status === ('connected' as ConnectionStatus)
  }

  /**
   * 处理服务器消息
   */
  private handleMessage(message: ServerMessage): void {
    // 触发特定类型的监听器
    this.emit(message.type, message.payload)

    // 触发通用message监听器
    this.emit('message', message)
  }

  /**
   * 触发事件
   */
  private emit(event: string, payload: any): void {
    const handlers = this.listeners.get(event)
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(payload)
        } catch (error) {
          console.error(`[WebSocketClient] 事件处理器错误 (${event}):`, error)
        }
      })
    }
  }

  /**
   * 设置连接状态
   */
  private setStatus(status: ConnectionStatus): void {
    const oldStatus = this.status
    this.status = status

    if (oldStatus !== status) {
      this.emit('status', status)
    }
  }

  /**
   * 安排重连
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error('[WebSocketClient] 达到最大重连次数，停止重连')
      this.setStatus('error' as ConnectionStatus)
      return
    }

    if (this.reconnectTimer) {
      return
    }

    this.reconnectAttempts++
    const delay = Math.min(
      this.config.reconnectInterval * Math.pow(1.5, this.reconnectAttempts - 1),
      30000
    )

    console.log(`[WebSocketClient] 将在 ${delay}ms 后进行第 ${this.reconnectAttempts} 次重连`)
    this.setStatus('reconnecting' as ConnectionStatus)

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, delay)
  }

  /**
   * 停止重连
   */
  private stopReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.reconnectAttempts = 0
  }

  /**
   * 启动心跳
   */
  private startHeartbeat(): void {
    this.stopHeartbeat()

    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected()) {
        this.send({ type: 'ping' })
      }
    }, this.config.heartbeatInterval)
  }

  /**
   * 停止心跳
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }
}
