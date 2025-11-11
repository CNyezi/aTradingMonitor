'use client'

import { WebSocketProvider } from '@/contexts/WebSocketContext'
import { authClient } from '@/lib/auth/auth-client'

/**
 * Dashboard相关的Providers
 * 负责在客户端初始化WebSocket等服务
 */
export function DashboardProviders({ children }: { children: React.ReactNode }) {
  // 使用Better Auth的useSession hook获取session
  const { data: session } = authClient.useSession()

  // 从session中提取token
  const token = session?.session?.token

  // 如果没有session或token，不初始化WebSocket
  if (!session || !token) {
    return <>{children}</>
  }

  return <WebSocketProvider token={token}>{children}</WebSocketProvider>
}
