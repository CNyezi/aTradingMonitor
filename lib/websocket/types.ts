/**
 * WebSocket消息类型定义（前端）
 */

/**
 * 客户端发送的消息类型
 */
export type ClientMessage =
  | {
      type: 'subscribe_stocks'
      payload: { tsCodes: string[] }
    }
  | {
      type: 'unsubscribe_stocks'
      payload: { tsCodes: string[] }
    }
  | {
      type: 'ping'
    }

/**
 * 服务器发送的消息类型
 */
export type ServerMessage =
  | {
      type: 'stock_update'
      payload: {
        tsCode: string
        currentPrice: number
        change: number
        changePercent: number
        open: number
        high: number
        low: number
        preClose: number
        volume: number
        amount: number
        timestamp: number
      }
    }
  | {
      type: 'alert'
      payload: {
        id: string
        title: string
        message: string
        severity: 'info' | 'warning' | 'error'
      }
    }
  | {
      type: 'notification'
      payload: {
        id: string
        title: string
        message: string
      }
    }
  | {
      type: 'pong'
    }
  | {
      type: 'error'
      payload: {
        message: string
        code?: string
      }
    }

/**
 * 实时行情数据
 */
export interface RealtimeQuote {
  tsCode: string
  currentPrice: number
  change: number
  changePercent: number
  open: number
  high: number
  low: number
  preClose: number
  volume: number
  amount: number
  timestamp: number
}

/**
 * WebSocket连接状态
 */
export enum ConnectionStatus {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error',
}

/**
 * 消息处理器类型
 */
export type MessageHandler<T = any> = (payload: T) => void

/**
 * WebSocket配置
 */
export interface WebSocketConfig {
  url: string
  reconnectInterval?: number
  maxReconnectAttempts?: number
  heartbeatInterval?: number
}
