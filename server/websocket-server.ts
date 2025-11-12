// 在最顶部加载环境变量（必须在任何其他导入之前）
import dotenv from 'dotenv'
import { resolve } from 'path'

// 加载 .env.local 文件
dotenv.config({ path: resolve(process.cwd(), '.env.local') })

import { WebSocketServer, WebSocket } from 'ws'
import type { IncomingMessage } from 'http'
import { ConnectionManager } from './managers/connection-manager'
import { SubscriptionManager } from './managers/subscription-manager'
import { StockDataService } from './services/stock-data-service'
import { MessageRouter } from './services/message-router'
import { TestDataGenerator } from './services/test-data-generator'
import type { AuthenticatedWebSocket } from './types'
import { db } from '@/lib/db'
import { session } from '@/lib/db/schema'
import { eq, gt } from 'drizzle-orm'

const PORT = process.env.WS_PORT ? parseInt(process.env.WS_PORT) : 3333
const HEARTBEAT_INTERVAL = 30000 // 30秒心跳检测
const TEST_MODE = process.env.WS_TEST_MODE === 'true' // 测试模式开关

/**
 * WebSocket服务器
 * 负责WebSocket连接的建立、认证、生命周期管理
 */
export class WSServer {
  private wss: WebSocketServer
  private connectionManager: ConnectionManager
  private subscriptionManager: SubscriptionManager
  private stockDataService: StockDataService
  private messageRouter: MessageRouter
  private heartbeatInterval: NodeJS.Timeout | null = null
  private testDataGenerator: TestDataGenerator | null = null
  private testDataInterval: NodeJS.Timeout | null = null

  constructor() {
    this.wss = new WebSocketServer({ port: PORT })
    this.connectionManager = new ConnectionManager()
    this.subscriptionManager = new SubscriptionManager()
    this.stockDataService = new StockDataService(this.subscriptionManager, this.connectionManager)
    this.messageRouter = new MessageRouter(this.subscriptionManager, this.connectionManager)

    this.setupServer()
    this.startHeartbeat()

    // 根据测试模式选择数据源
    if (TEST_MODE) {
      this.startTestMode()
    } else {
      this.startStockDataService()
    }

    console.log(
      `[WSServer] WebSocket服务器启动在端口 ${PORT} ${TEST_MODE ? '(测试模式)' : '(生产模式)'}`
    )
  }

  /**
   * 设置WebSocket服务器
   */
  private setupServer(): void {
    this.wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
      try {
        // 从查询参数中获取token
        const url = new URL(req.url || '', `http://${req.headers.host}`)
        const token = url.searchParams.get('token')

        if (!token) {
          ws.close(1008, '缺少认证token')
          return
        }

        // 验证token并获取用户ID
        const userId = await this.authenticateToken(token)
        if (!userId) {
          ws.close(1008, '无效的认证token')
          return
        }

        // 扩展WebSocket对象
        const authWs = ws as AuthenticatedWebSocket
        authWs.userId = userId
        authWs.isAlive = true

        // 添加到连接管理器
        this.connectionManager.addConnection(userId, authWs)

        // 设置事件监听
        this.setupWebSocketHandlers(authWs)

        console.log(`[WSServer] 用户 ${userId} 已认证并连接`)
      } catch (error) {
        console.error('[WSServer] 连接处理失败:', error)
        ws.close(1011, '服务器内部错误')
      }
    })

    this.wss.on('error', (error) => {
      console.error('[WSServer] WebSocket服务器错误:', error)
    })
  }

  /**
   * 设置WebSocket事件处理器
   */
  private setupWebSocketHandlers(ws: AuthenticatedWebSocket): void {
    // 处理消息
    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString())
        this.messageRouter.handleMessage(ws.userId, message)
      } catch (error) {
        console.error(`[WSServer] 解析用户 ${ws.userId} 的消息失败:`, error)
        this.connectionManager.sendToUser(ws.userId, {
          type: 'error',
          payload: { message: '无效的消息格式' },
        })
      }
    })

    // 处理pong响应
    ws.on('pong', () => {
      ws.isAlive = true
    })

    // 处理连接关闭
    ws.on('close', (code, reason) => {
      console.log(`[WSServer] 用户 ${ws.userId} 断开连接: ${code} - ${reason}`)
      this.subscriptionManager.unsubscribeAll(ws.userId)
      this.connectionManager.removeConnection(ws.userId)
    })

    // 处理错误
    ws.on('error', (error) => {
      console.error(`[WSServer] 用户 ${ws.userId} 连接错误:`, error)
    })
  }

  /**
   * 验证token并返回用户ID
   * 直接查询数据库验证session，不依赖Better Auth API
   */
  private async authenticateToken(token: string): Promise<string | null> {
    try {
      console.log('[WSServer] 开始验证token:', token.substring(0, 20) + '...')

      // 直接查询数据库中的session表
      const sessionRecords = await db
        .select()
        .from(session)
        .where(eq(session.token, token))
        .limit(1)

      if (sessionRecords.length === 0) {
        console.log('[WSServer] Session验证失败: token不存在')
        return null
      }

      const sessionRecord = sessionRecords[0]

      // 检查session是否已过期
      if (sessionRecord.expiresAt < new Date()) {
        console.log('[WSServer] Session验证失败: session已过期')
        return null
      }

      console.log(`[WSServer] Session验证成功: userId=${sessionRecord.userId}`)
      return sessionRecord.userId
    } catch (error) {
      console.error('[WSServer] Token验证失败:', error)
      return null
    }
  }

  /**
   * 启动心跳检测
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.connectionManager.performHeartbeat()
    }, HEARTBEAT_INTERVAL)

    console.log(`[WSServer] 心跳检测已启动，间隔 ${HEARTBEAT_INTERVAL}ms`)
  }

  /**
   * 启动股票数据服务 (生产模式)
   */
  private startStockDataService(): void {
    this.stockDataService.start()
    console.log('[WSServer] 股票数据服务已启动 (真实数据)')
  }

  /**
   * 启动测试模式 (模拟数据)
   */
  private startTestMode(): void {
    this.testDataGenerator = new TestDataGenerator()

    // 自动订阅所有测试股票
    const testStockCodes = this.testDataGenerator.getAllStockCodes()
    console.log(`[WSServer] 测试模式: 自动订阅 ${testStockCodes.length} 只测试股票`)

    // 每1秒推送一次模拟数据
    this.testDataInterval = setInterval(() => {
      if (!this.testDataGenerator) return

      // 生成所有股票的最新行情
      const quotes = this.testDataGenerator.generateAllQuotes()

      // 推送给所有连接的客户端
      quotes.forEach((quote) => {
        this.connectionManager.broadcast({
          type: 'stock_update',
          payload: quote,
        })
      })
    }, 1000)

    console.log('[WSServer] 测试模式已启动: 每秒推送模拟数据')
    console.log('[WSServer] 测试股票列表:', testStockCodes.join(', '))
    console.log('[WSServer] 提示: 系统会随机触发告警 (价格波动、成交量激增、涨停/跌停)')
  }

  /**
   * 关闭服务器
   */
  close(callback?: () => void): void {
    console.log('[WSServer] 正在关闭服务器...')

    // 停止心跳检测
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }

    // 停止测试模式定时器
    if (this.testDataInterval) {
      clearInterval(this.testDataInterval)
      this.testDataInterval = null
      console.log('[WSServer] 测试模式已停止')
    }

    // 停止股票数据服务
    if (!TEST_MODE) {
      this.stockDataService.stop()
    }

    // 关闭所有连接
    this.connectionManager.closeAll()

    // 关闭WebSocket服务器
    this.wss.close((error) => {
      if (error) {
        console.error('[WSServer] 关闭服务器时出错:', error)
      } else {
        console.log('[WSServer] WebSocket服务器已关闭')
      }

      // 执行回调
      if (callback) {
        callback()
      }
    })
  }
}

// 启动服务器
const server = new WSServer()

// 优雅关闭处理函数
let isShuttingDown = false

function gracefulShutdown(signal: string) {
  if (isShuttingDown) {
    console.log(`[WSServer] 已在关闭中，忽略 ${signal} 信号`)
    return
  }

  isShuttingDown = true
  console.log(`\n[WSServer] 收到 ${signal} 信号，准备关闭服务器...`)

  // 设置超时强制退出（5秒后）
  const forceExitTimeout = setTimeout(() => {
    console.error('[WSServer] 优雅关闭超时，强制退出')
    process.exit(1)
  }, 5000)

  // 执行优雅关闭，等待回调
  server.close(() => {
    // 清理超时定时器
    clearTimeout(forceExitTimeout)

    console.log('[WSServer] 服务器已成功关闭')
    process.exit(0)
  })
}

// 监听信号
process.on('SIGINT', () => gracefulShutdown('SIGINT'))
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  console.error('[WSServer] 未捕获的异常:', error)
  gracefulShutdown('uncaughtException')
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('[WSServer] 未处理的Promise拒绝:', reason)
  gracefulShutdown('unhandledRejection')
})
