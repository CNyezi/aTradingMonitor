'use client'

import { WebSocketClient } from '@/lib/websocket/client'
import type { ConnectionStatus } from '@/lib/websocket/types'
import { createContext, useContext, useEffect, useRef, useState } from 'react'

interface WebSocketContextValue {
  client: WebSocketClient | null
  status: ConnectionStatus
  isConnected: boolean
}

const WebSocketContext = createContext<WebSocketContextValue | undefined>(undefined)

// 全局单例客户端，确保整个应用只有一个 WebSocket 连接
let globalClient: WebSocketClient | null = null
let globalClientInitializing = false

interface WebSocketProviderProps {
  children: React.ReactNode
  token: string // Better Auth session token
}

/**
 * WebSocket全局Provider
 * 负责在用户登录时建立WebSocket连接，并在整个应用中共享
 */
export function WebSocketProvider({ children, token }: WebSocketProviderProps) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected' as ConnectionStatus)
  const statusHandlerRef = useRef<((newStatus: ConnectionStatus) => void) | null>(null)

  useEffect(() => {
    if (!token) {
      console.warn('[WebSocketProvider] 缺少token，跳过连接')
      return
    }

    // 如果全局客户端正在初始化，等待完成
    if (globalClientInitializing) {
      console.log('[WebSocketProvider] 全局客户端正在初始化，等待完成')
      return
    }

    // 如果全局客户端已存在，直接使用
    if (globalClient) {
      console.log('[WebSocketProvider] 使用现有的全局WebSocket连接')

      // 创建状态处理器
      const statusHandler = (newStatus: ConnectionStatus) => {
        setStatus(newStatus)
      }
      statusHandlerRef.current = statusHandler

      // 注册状态监听器
      globalClient.on<ConnectionStatus>('status', statusHandler)

      // 获取当前状态
      setStatus(globalClient.getStatus())

      return () => {
        if (statusHandlerRef.current && globalClient) {
          globalClient.off('status', statusHandlerRef.current)
        }
      }
    }

    // 创建新的全局客户端
    globalClientInitializing = true
    console.log('[WebSocketProvider] 创建全局WebSocket连接')

    // 获取WebSocket URL
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsHost = process.env.NEXT_PUBLIC_WS_HOST || window.location.hostname
    const wsPort = process.env.NEXT_PUBLIC_WS_PORT || '3000'
    const wsUrl = `${wsProtocol}//${wsHost}:${wsPort}?token=${encodeURIComponent(token)}`

    console.log('[WebSocketProvider] 初始化WebSocket连接:', wsUrl)

    // 创建WebSocket客户端
    const client = new WebSocketClient({
      url: wsUrl,
      reconnectInterval: 3000,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000,
    })

    globalClient = client

    // 创建状态处理器
    const statusHandler = (newStatus: ConnectionStatus) => {
      console.log('[WebSocketProvider] 连接状态变化:', newStatus)
      setStatus(newStatus)
    }
    statusHandlerRef.current = statusHandler

    // 监听连接状态变化
    client.on<ConnectionStatus>('status', statusHandler)

    // 监听错误
    client.on('error', (error) => {
      console.error('[WebSocketProvider] WebSocket错误:', error)
    })

    // 监听服务器错误消息
    client.on<{ message: string; code?: string }>('error', (payload) => {
      console.error('[WebSocketProvider] 服务器错误:', payload.message)
    })

    // 建立连接
    client.connect()
    globalClientInitializing = false

    // 清理函数（只移除监听器，不断开连接）
    return () => {
      console.log('[WebSocketProvider] 移除状态监听器')
      if (statusHandlerRef.current && globalClient) {
        globalClient.off('status', statusHandlerRef.current)
      }
    }
  }, [token])

  const value: WebSocketContextValue = {
    client: globalClient,
    status,
    isConnected: status === ('connected' as ConnectionStatus),
  }

  return <WebSocketContext.Provider value={value}>{children}</WebSocketContext.Provider>
}

/**
 * 使用WebSocket Context的Hook
 * 如果在Provider外部使用，返回安全的默认值而不抛出错误
 */
export function useWebSocket(): WebSocketContextValue {
  const context = useContext(WebSocketContext)
  if (context === undefined) {
    console.warn('[useWebSocket] Used outside WebSocketProvider, returning default values')
    return {
      client: null,
      status: 'disconnected' as ConnectionStatus,
      isConnected: false,
    }
  }
  return context
}
