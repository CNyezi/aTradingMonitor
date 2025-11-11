import type { WebSocket } from 'ws'

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
 * 扩展WebSocket以包含用户信息
 */
export interface AuthenticatedWebSocket extends WebSocket {
  userId: string
  isAlive: boolean
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
