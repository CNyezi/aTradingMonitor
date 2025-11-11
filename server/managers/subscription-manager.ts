/**
 * 订阅管理器
 * 负责管理用户的股票订阅关系，支持正向和反向查询
 * - 正向: userId → Set<tsCode> (某用户订阅了哪些股票)
 * - 反向: tsCode → Set<userId> (某股票被哪些用户订阅)
 */
export class SubscriptionManager {
  // 用户 → 订阅的股票列表
  private userSubscriptions: Map<string, Set<string>> = new Map()
  // 股票 → 订阅的用户列表
  private stockSubscribers: Map<string, Set<string>> = new Map()

  /**
   * 用户订阅股票
   */
  subscribe(userId: string, tsCodes: string[]): void {
    // 获取或创建用户的订阅集合
    let userStocks = this.userSubscriptions.get(userId)
    if (!userStocks) {
      userStocks = new Set()
      this.userSubscriptions.set(userId, userStocks)
    }

    // 添加订阅关系
    for (const tsCode of tsCodes) {
      // 正向映射
      userStocks.add(tsCode)

      // 反向映射
      let subscribers = this.stockSubscribers.get(tsCode)
      if (!subscribers) {
        subscribers = new Set()
        this.stockSubscribers.set(tsCode, subscribers)
      }
      subscribers.add(userId)
    }

    console.log(
      `[SubscriptionManager] 用户 ${userId} 订阅了 ${tsCodes.length} 只股票:`,
      tsCodes
    )
  }

  /**
   * 用户取消订阅股票
   */
  unsubscribe(userId: string, tsCodes: string[]): void {
    const userStocks = this.userSubscriptions.get(userId)
    if (!userStocks) {
      return
    }

    for (const tsCode of tsCodes) {
      // 移除正向映射
      userStocks.delete(tsCode)

      // 移除反向映射
      const subscribers = this.stockSubscribers.get(tsCode)
      if (subscribers) {
        subscribers.delete(userId)
        // 如果没有用户订阅该股票，移除股票记录
        if (subscribers.size === 0) {
          this.stockSubscribers.delete(tsCode)
        }
      }
    }

    // 如果用户没有订阅任何股票，移除用户记录
    if (userStocks.size === 0) {
      this.userSubscriptions.delete(userId)
    }

    console.log(
      `[SubscriptionManager] 用户 ${userId} 取消订阅了 ${tsCodes.length} 只股票:`,
      tsCodes
    )
  }

  /**
   * 用户断开连接时清理所有订阅
   */
  unsubscribeAll(userId: string): void {
    const userStocks = this.userSubscriptions.get(userId)
    if (!userStocks) {
      return
    }

    // 从所有股票的订阅者列表中移除该用户
    for (const tsCode of userStocks) {
      const subscribers = this.stockSubscribers.get(tsCode)
      if (subscribers) {
        subscribers.delete(userId)
        if (subscribers.size === 0) {
          this.stockSubscribers.delete(tsCode)
        }
      }
    }

    // 删除用户的订阅记录
    this.userSubscriptions.delete(userId)
    console.log(`[SubscriptionManager] 用户 ${userId} 的所有订阅已清理`)
  }

  /**
   * 获取用户订阅的所有股票
   */
  getUserSubscriptions(userId: string): string[] {
    const userStocks = this.userSubscriptions.get(userId)
    return userStocks ? Array.from(userStocks) : []
  }

  /**
   * 获取订阅某只股票的所有用户
   */
  getStockSubscribers(tsCode: string): string[] {
    const subscribers = this.stockSubscribers.get(tsCode)
    return subscribers ? Array.from(subscribers) : []
  }

  /**
   * 获取所有被订阅的股票列表（用于批量请求API）
   */
  getAllSubscribedStocks(): string[] {
    return Array.from(this.stockSubscribers.keys())
  }

  /**
   * 检查用户是否订阅了某只股票
   */
  isUserSubscribed(userId: string, tsCode: string): boolean {
    const userStocks = this.userSubscriptions.get(userId)
    return userStocks ? userStocks.has(tsCode) : false
  }

  /**
   * 获取订阅统计信息
   */
  getStats(): {
    totalUsers: number
    totalStocks: number
    totalSubscriptions: number
  } {
    let totalSubscriptions = 0
    for (const userStocks of this.userSubscriptions.values()) {
      totalSubscriptions += userStocks.size
    }

    return {
      totalUsers: this.userSubscriptions.size,
      totalStocks: this.stockSubscribers.size,
      totalSubscriptions,
    }
  }

  /**
   * 打印当前订阅状态（用于调试）
   */
  printStatus(): void {
    const stats = this.getStats()
    console.log('[SubscriptionManager] 当前订阅状态:')
    console.log(`  - 用户数: ${stats.totalUsers}`)
    console.log(`  - 股票数: ${stats.totalStocks}`)
    console.log(`  - 订阅总数: ${stats.totalSubscriptions}`)

    // 打印每只股票的订阅者数量
    if (this.stockSubscribers.size > 0) {
      console.log('  - 股票订阅详情:')
      for (const [tsCode, subscribers] of this.stockSubscribers) {
        console.log(`    ${tsCode}: ${subscribers.size} 个订阅者`)
      }
    }
  }
}
