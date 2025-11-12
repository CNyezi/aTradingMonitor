'use client'

import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type { StockWithGroup } from '@/lib/tushare'
import type { RealtimeQuote } from '@/lib/websocket/types'
import { useTranslations } from 'next-intl'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SummaryStatsProps {
  stocks: StockWithGroup[]
  realtimeData: Map<string, RealtimeQuote>
  isAmountVisible: boolean
  onToggleVisibility: () => void
}

// 格式化数字
const formatNumber = (num: number, decimals = 2): string => {
  return num.toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function SummaryStats({
  stocks,
  realtimeData,
  isAmountVisible,
  onToggleVisibility,
}: SummaryStatsProps) {
  const t = useTranslations('MyStocks.summary')

  // 计算统计数据
  const statistics = (() => {
    let totalCost = 0
    let totalValue = 0
    let stocksWithPosition = 0

    stocks.forEach((stock) => {
      if (stock.costPrice && stock.quantity) {
        const quote = realtimeData.get(stock.tsCode)
        if (quote) {
          const costPrice = parseFloat(stock.costPrice)
          totalCost += costPrice * stock.quantity
          totalValue += quote.currentPrice * stock.quantity
          stocksWithPosition++
        }
      }
    })

    const totalProfitLoss = totalValue - totalCost
    const totalProfitLossRatio = totalCost > 0 ? (totalProfitLoss / totalCost) * 100 : 0
    const isProfit = totalProfitLoss >= 0

    return {
      totalStocks: stocks.length,
      stocksWithPosition,
      totalCost,
      totalValue,
      totalProfitLoss,
      totalProfitLossRatio,
      isProfit,
      hasPositions: stocksWithPosition > 0,
    }
  })()

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 px-4 py-2 bg-muted/30 rounded-lg border text-sm">
      {/* 持股总数 - 始终显示 */}
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{t('totalStocks')}:</span>
        <span className="font-semibold">
          {statistics.totalStocks} {t('stocks')}
        </span>
      </div>

      <Separator orientation="vertical" className="h-4 hidden sm:block" />

      {/* 总盈亏 - 移动端优先显示 */}
      {statistics.hasPositions && (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{t('totalProfit')}:</span>
          <span
            className={cn(
              'font-semibold',
              statistics.isProfit
                ? 'text-red-600 dark:text-red-400'
                : 'text-green-600 dark:text-green-400'
            )}
          >
            {isAmountVisible ? (
              <>
                {statistics.isProfit ? '+' : ''}¥
                {formatNumber(Math.abs(statistics.totalProfitLoss))}
              </>
            ) : (
              '****'
            )}
            <span className="ml-1">
              ({statistics.isProfit ? '+' : ''}
              {formatNumber(statistics.totalProfitLossRatio)}%)
            </span>
          </span>
        </div>
      )}

      {/* 成本和市值 - 桌面端显示 */}
      {statistics.hasPositions && (
        <div className="hidden md:flex items-center gap-6">
          <Separator orientation="vertical" className="h-4" />

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">{t('totalCost')}:</span>
            <span className="font-semibold">
              {isAmountVisible ? `¥${formatNumber(statistics.totalCost)}` : '****'}
            </span>
          </div>

          <Separator orientation="vertical" className="h-4" />

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">{t('totalValue')}:</span>
            <span className="font-semibold">
              {isAmountVisible ? `¥${formatNumber(statistics.totalValue)}` : '****'}
            </span>
          </div>
        </div>
      )}

      {/* 眼睛开关 */}
      <div className="ml-auto">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onToggleVisibility}
          title={t('toggleVisibility')}
        >
          {isAmountVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  )
}
