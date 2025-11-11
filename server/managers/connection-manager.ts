import type { AuthenticatedWebSocket, ServerMessage } from '../types'

/**
 * WebSocket连接管理器
 * 负责维护所有用户的WebSocket连接，提供广播和单播功能
 */
export class ConnectionManager {
  private connections: Map<string, AuthenticatedWebSocket> = new Map()

  /**
   * 添加新连接
   */
  addConnection(userId: string, ws: AuthenticatedWebSocket): void {
    // 如果用户已有连接，先关闭旧连接
    const existingConnection = this.connections.get(userId)
    if (existingConnection) {
      console.log(`[ConnectionManager] 关闭用户 ${userId} 的旧连接`)
      existingConnection.close(1000, '新连接已建立')
    }

    this.connections.set(userId, ws)
    console.log(`[ConnectionManager] 用户 ${userId} 已连接，当前连接数: ${this.connections.size}`)
  }

  /**
   * 移除连接
   */
  removeConnection(userId: string): void {
    const removed = this.connections.delete(userId)
    if (removed) {
      console.log(`[ConnectionManager] 用户 ${userId} 已断开，当前连接数: ${this.connections.size}`)
    }
  }

  /**
   * 获取用户连接
   */
  getConnection(userId: string): AuthenticatedWebSocket | undefined {
    return this.connections.get(userId)
  }

  /**
   * 检查用户是否在线
   */
  isUserOnline(userId: string): boolean {
    const ws = this.connections.get(userId)
    return ws !== undefined && ws.readyState === ws.OPEN
  }

  /**
   * 发送消息给指定用户
   */
  sendToUser(userId: string, message: ServerMessage): boolean {
    const ws = this.connections.get(userId)
    if (!ws || ws.readyState !== ws.OPEN) {
      return false
    }

    try {
      ws.send(JSON.stringify(message))
      return true
    } catch (error) {
      console.error(`[ConnectionManager] 发送消息给用户 ${userId} 失败:`, error)
      return false
    }
  }

  /**
   * 批量发送消息给多个用户
   */
  sendToUsers(userIds: string[], message: ServerMessage): number {
    let successCount = 0
    for (const userId of userIds) {
      if (this.sendToUser(userId, message)) {
        successCount++
      }
    }
    return successCount
  }

  /**
   * 广播消息给所有在线用户
   */
  broadcast(message: ServerMessage): number {
    let successCount = 0
    for (const [userId, ws] of this.connections) {
      if (ws.readyState === ws.OPEN) {
        try {
          ws.send(JSON.stringify(message))
          successCount++
        } catch (error) {
          console.error(`[ConnectionManager] 广播消息给用户 ${userId} 失败:`, error)
        }
      }
    }
    return successCount
  }

  /**
   * 获取所有在线用户ID
   */
  getOnlineUserIds(): string[] {
    const userIds: string[] = []
    for (const [userId, ws] of this.connections) {
      if (ws.readyState === ws.OPEN) {
        userIds.push(userId)
      }
    }
    return userIds
  }

  /**
   * 获取连接数
   */
  getConnectionCount(): number {
    return this.connections.size
  }

  /**
   * 心跳检测 - 清理死连接
   */
  performHeartbeat(): void {
    const deadConnections: string[] = []

    for (const [userId, ws] of this.connections) {
      if (!ws.isAlive) {
        console.log(`[ConnectionManager] 用户 ${userId} 心跳超时，准备关闭连接`)
        ws.terminate()
        deadConnections.push(userId)
      } else {
        // 重置心跳标记
        ws.isAlive = false
        // 发送ping
        ws.ping()
      }
    }

    // 清理死连接
    for (const userId of deadConnections) {
      this.removeConnection(userId)
    }
  }

  /**
   * 关闭所有连接
   */
  closeAll(): void {
    console.log(`[ConnectionManager] 关闭所有连接，共 ${this.connections.size} 个`)
    for (const [userId, ws] of this.connections) {
      try {
        ws.close(1000, '服务器关闭')
      } catch (error) {
        console.error(`[ConnectionManager] 关闭用户 ${userId} 连接失败:`, error)
      }
    }
    this.connections.clear()
  }
}
