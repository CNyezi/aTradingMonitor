'use client'

import { useWebSocket } from '@/contexts/WebSocketContext'
import type { RealtimeQuote } from '@/lib/websocket/types'
import { useEffect, useRef, useState } from 'react'

/**
 * 股票订阅Hook
 * 用于组件级别的股票数据订阅
 *
 * @param tsCodes 要订阅的股票代码列表
 * @returns 实时行情数据Map和加载状态
 */
export function useStockSubscription(tsCodes: string[]) {
  const { client, isConnected } = useWebSocket()
  const [quotes, setQuotes] = useState<Map<string, RealtimeQuote>>(new Map())
  const [loading, setLoading] = useState(true)
  const subscribedCodesRef = useRef<string[]>([])

  useEffect(() => {
    if (!client || !isConnected || tsCodes.length === 0) {
      setLoading(false)
      return
    }

    // 过滤出有效的股票代码
    const validCodes = tsCodes.filter((code) => /^\d{6}\.(SH|SZ|BJ)$/.test(code))

    if (validCodes.length === 0) {
      setLoading(false)
      return
    }

    console.log('[useStockSubscription] 订阅股票:', validCodes)

    // 订阅股票
    client.subscribeStocks(validCodes)
    subscribedCodesRef.current = validCodes

    // 监听股票更新
    const handleStockUpdate = (quote: RealtimeQuote) => {
      setQuotes((prev) => {
        const next = new Map(prev)
        next.set(quote.tsCode, quote)
        return next
      })

      // 首次接收到数据后，设置loading为false
      setLoading(false)
    }

    client.on<RealtimeQuote>('stock_update', handleStockUpdate)

    // 清理函数：取消订阅
    return () => {
      if (subscribedCodesRef.current.length > 0) {
        console.log('[useStockSubscription] 取消订阅股票:', subscribedCodesRef.current)
        client.unsubscribeStocks(subscribedCodesRef.current)
        client.off('stock_update', handleStockUpdate)
      }
    }
  }, [client, isConnected, tsCodes.join(',')])

  return {
    quotes,
    loading,
    isConnected,
  }
}
