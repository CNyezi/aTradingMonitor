'use client'

import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { StockWithGroup } from '@/lib/tushare'
import type { RealtimeQuote } from '@/lib/websocket/types'
import type { ColumnDef } from '@tanstack/react-table'
import { ArrowUpDown, FolderInput, LineChart, Loader2, MoreVertical, Settings, Trash2, Wallet } from 'lucide-react'

// 格式化数字
const formatNumber = (num: number | null | undefined, decimals = 2): string => {
  if (num === null || num === undefined) return '-'
  return num.toFixed(decimals)
}

// 计算涨跌颜色
const getPriceColor = (value: number): string => {
  if (value > 0) return 'text-red-600 dark:text-red-400'
  if (value < 0) return 'text-green-600 dark:text-green-400'
  return 'text-muted-foreground'
}

export interface StockTableRow extends StockWithGroup {
  quote?: RealtimeQuote
}

export interface ColumnsConfig {
  t: (key: string) => string
  realtimeData: Map<string, RealtimeQuote>
  stockRuleCounts: Map<string, number>
  isAmountVisible: boolean
  toggling: string | null
  removing: string | null
  moving: string | null
  onToggleMonitoring: (stockId: string, currentStatus: boolean) => void
  onOpenRules: (stockId: string) => void
  onOpenKLine: (stockId: string) => void
  onEditPosition: (stockId: string) => void
  onMove: (stockId: string, groupId: string | null) => void
  onRemove: (stockId: string) => void
  groups: Array<{ id: string; name: string }>
}

export const createColumns = (config: ColumnsConfig): ColumnDef<StockTableRow>[] => {
  const {
    t,
    realtimeData,
    stockRuleCounts,
    isAmountVisible,
    toggling,
    removing,
    moving,
    onToggleMonitoring,
    onOpenRules,
    onOpenKLine,
    onEditPosition,
    onMove,
    onRemove,
    groups,
  } = config

  return [
    // 股票名称和代码列（固定）
    {
      id: 'name',
      header: t('table.stockName'),
      size: 120,
      cell: ({ row }) => {
        const stock = row.original
        return (
          <div className="min-w-[120px]">
            <div className="font-medium">{stock.name}</div>
            <div className="text-xs text-muted-foreground">{stock.symbol}</div>
          </div>
        )
      },
      enableSorting: false,
    },

    // 现价列（固定，可排序）
    {
      id: 'currentPrice',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            {t('table.currentPrice')}
            <ArrowUpDown className="ml-1 h-3 w-3" />
          </Button>
        )
      },
      size: 80,
      cell: ({ row }) => {
        const stock = row.original
        const quote = realtimeData.get(stock.tsCode)
        if (!quote) return <div className="text-right text-muted-foreground">-</div>

        const colorClass = getPriceColor(quote.change)
        return (
          <div className={`text-right font-bold ${colorClass}`}>
            {formatNumber(quote.currentPrice)}
          </div>
        )
      },
      sortingFn: (rowA, rowB) => {
        const quoteA = realtimeData.get(rowA.original.tsCode)
        const quoteB = realtimeData.get(rowB.original.tsCode)
        const priceA = quoteA?.currentPrice ?? 0
        const priceB = quoteB?.currentPrice ?? 0
        return priceA - priceB
      },
    },

    // 涨跌幅列（可排序）
    {
      id: 'changePercent',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            {t('table.changePercent')}
            <ArrowUpDown className="ml-1 h-3 w-3" />
          </Button>
        )
      },
      size: 80,
      cell: ({ row }) => {
        const stock = row.original
        const quote = realtimeData.get(stock.tsCode)
        if (!quote) return <div className="text-right text-muted-foreground">-</div>

        const colorClass = getPriceColor(quote.change)
        return (
          <div className={`text-right font-semibold ${colorClass}`}>
            {quote.change >= 0 ? '+' : ''}
            {formatNumber(quote.changePercent)}%
          </div>
        )
      },
      sortingFn: (rowA, rowB) => {
        const quoteA = realtimeData.get(rowA.original.tsCode)
        const quoteB = realtimeData.get(rowB.original.tsCode)
        const changeA = quoteA?.changePercent ?? 0
        const changeB = quoteB?.changePercent ?? 0
        return changeA - changeB
      },
    },

    // 涨跌额列
    {
      id: 'change',
      header: t('table.change'),
      size: 80,
      cell: ({ row }) => {
        const stock = row.original
        const quote = realtimeData.get(stock.tsCode)
        if (!quote) return <div className="text-right text-muted-foreground">-</div>

        const colorClass = getPriceColor(quote.change)
        return (
          <div className={`text-right ${colorClass}`}>
            {quote.change >= 0 ? '+' : ''}
            {formatNumber(quote.change)}
          </div>
        )
      },
    },

    // 持仓成本列
    {
      id: 'costPrice',
      header: t('table.costPrice'),
      size: 80,
      cell: ({ row }) => {
        const stock = row.original
        if (!stock.costPrice) return <div className="text-right text-muted-foreground">-</div>
        return (
          <div className="text-right">
            {isAmountVisible ? formatNumber(parseFloat(stock.costPrice)) : '****'}
          </div>
        )
      },
    },

    // 持股数量列
    {
      id: 'quantity',
      header: t('table.quantity'),
      size: 80,
      cell: ({ row }) => {
        const stock = row.original
        if (!stock.quantity) return <div className="text-right text-muted-foreground">-</div>
        return (
          <div className="text-right">
            {stock.quantity}
          </div>
        )
      },
    },

    // 当前市值列
    {
      id: 'currentValue',
      header: t('table.currentValue'),
      size: 100,
      cell: ({ row }) => {
        const stock = row.original
        const quote = realtimeData.get(stock.tsCode)
        if (!stock.quantity || !quote) return <div className="text-right text-muted-foreground">-</div>

        const currentValue = quote.currentPrice * stock.quantity
        return (
          <div className="text-right font-medium">
            {isAmountVisible ? formatNumber(currentValue) : '******'}
          </div>
        )
      },
    },

    // 盈亏金额列（可排序）
    {
      id: 'profitLoss',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            {t('table.profitLoss')}
            <ArrowUpDown className="ml-1 h-3 w-3" />
          </Button>
        )
      },
      size: 100,
      cell: ({ row }) => {
        const stock = row.original
        const quote = realtimeData.get(stock.tsCode)
        if (!stock.costPrice || !stock.quantity || !quote) {
          return <div className="text-right text-muted-foreground">-</div>
        }

        const costPrice = parseFloat(stock.costPrice)
        const totalCost = costPrice * stock.quantity
        const currentValue = quote.currentPrice * stock.quantity
        const profitLoss = currentValue - totalCost
        const colorClass = getPriceColor(profitLoss)

        return (
          <div className={`text-right font-semibold ${colorClass}`}>
            {isAmountVisible ? (
              <>
                {profitLoss >= 0 ? '+' : ''}
                {formatNumber(profitLoss)}
              </>
            ) : (
              '****'
            )}
          </div>
        )
      },
      sortingFn: (rowA, rowB) => {
        const stockA = rowA.original
        const stockB = rowB.original
        const quoteA = realtimeData.get(stockA.tsCode)
        const quoteB = realtimeData.get(stockB.tsCode)

        const getProfitLoss = (stock: StockWithGroup, quote?: RealtimeQuote) => {
          if (!stock.costPrice || !stock.quantity || !quote) return 0
          const costPrice = parseFloat(stock.costPrice)
          const totalCost = costPrice * stock.quantity
          const currentValue = quote.currentPrice * stock.quantity
          return currentValue - totalCost
        }

        return getProfitLoss(stockA, quoteA) - getProfitLoss(stockB, quoteB)
      },
    },

    // 盈亏比例列（可排序）
    {
      id: 'profitLossRatio',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            {t('table.profitLossRatio')}
            <ArrowUpDown className="ml-1 h-3 w-3" />
          </Button>
        )
      },
      size: 80,
      cell: ({ row }) => {
        const stock = row.original
        const quote = realtimeData.get(stock.tsCode)
        if (!stock.costPrice || !stock.quantity || !quote) {
          return <div className="text-right text-muted-foreground">-</div>
        }

        const costPrice = parseFloat(stock.costPrice)
        const totalCost = costPrice * stock.quantity
        const currentValue = quote.currentPrice * stock.quantity
        const profitLoss = currentValue - totalCost
        const profitLossRatio = (profitLoss / totalCost) * 100
        const colorClass = getPriceColor(profitLoss)

        return (
          <div className={`text-right font-semibold ${colorClass}`}>
            {profitLoss >= 0 ? '+' : ''}
            {formatNumber(profitLossRatio)}%
          </div>
        )
      },
      sortingFn: (rowA, rowB) => {
        const stockA = rowA.original
        const stockB = rowB.original
        const quoteA = realtimeData.get(stockA.tsCode)
        const quoteB = realtimeData.get(stockB.tsCode)

        const getRatio = (stock: StockWithGroup, quote?: RealtimeQuote) => {
          if (!stock.costPrice || !stock.quantity || !quote) return 0
          const costPrice = parseFloat(stock.costPrice)
          const totalCost = costPrice * stock.quantity
          const currentValue = quote.currentPrice * stock.quantity
          const profitLoss = currentValue - totalCost
          return (profitLoss / totalCost) * 100
        }

        return getRatio(stockA, quoteA) - getRatio(stockB, quoteB)
      },
    },

    // 今开列（响应式隐藏）
    {
      id: 'open',
      header: t('table.open'),
      size: 70,
      cell: ({ row }) => {
        const stock = row.original
        const quote = realtimeData.get(stock.tsCode)
        if (!quote) return <div className="text-right text-muted-foreground">-</div>
        return (
          <div className="text-right text-sm">
            {formatNumber(quote.open)}
          </div>
        )
      },
      meta: {
        className: 'hidden lg:table-cell',
      },
    },

    // 最高列（响应式隐藏）
    {
      id: 'high',
      header: t('table.high'),
      size: 70,
      cell: ({ row }) => {
        const stock = row.original
        const quote = realtimeData.get(stock.tsCode)
        if (!quote) return <div className="text-right text-muted-foreground">-</div>
        return (
          <div className="text-right text-sm text-red-600 dark:text-red-400">
            {formatNumber(quote.high)}
          </div>
        )
      },
      meta: {
        className: 'hidden lg:table-cell',
      },
    },

    // 最低列（响应式隐藏）
    {
      id: 'low',
      header: t('table.low'),
      size: 70,
      cell: ({ row }) => {
        const stock = row.original
        const quote = realtimeData.get(stock.tsCode)
        if (!quote) return <div className="text-right text-muted-foreground">-</div>
        return (
          <div className="text-right text-sm text-green-600 dark:text-green-400">
            {formatNumber(quote.low)}
          </div>
        )
      },
      meta: {
        className: 'hidden lg:table-cell',
      },
    },

    // 昨收列（响应式隐藏）
    {
      id: 'preClose',
      header: t('table.preClose'),
      size: 70,
      cell: ({ row }) => {
        const stock = row.original
        const quote = realtimeData.get(stock.tsCode)
        if (!quote) return <div className="text-right text-muted-foreground">-</div>
        return (
          <div className="text-right text-sm">
            {formatNumber(quote.preClose)}
          </div>
        )
      },
      meta: {
        className: 'hidden lg:table-cell',
      },
    },

    // 监控开关列
    {
      id: 'monitoring',
      header: t('table.monitoring'),
      size: 60,
      cell: ({ row }) => {
        const stock = row.original
        return (
          <div className="flex items-center justify-center">
            <Switch
              checked={stock.monitored}
              onCheckedChange={() => onToggleMonitoring(stock.id, stock.monitored)}
              disabled={toggling === stock.id}
            />
          </div>
        )
      },
    },

    // 规则数量列
    {
      id: 'rules',
      header: t('table.rules'),
      size: 80,
      cell: ({ row }) => {
        const stock = row.original
        const count = stockRuleCounts.get(stock.id) || 0
        return (
          <div className="flex justify-center">
            <Button
              variant="outline"
              size="sm"
              className="h-7"
              onClick={() => onOpenRules(stock.id)}
            >
              <Settings className="h-3 w-3 mr-1" />
              {count}
            </Button>
          </div>
        )
      },
    },

    // 操作列
    {
      id: 'actions',
      header: t('table.actions'),
      size: 120,
      cell: ({ row }) => {
        const stock = row.original
        const hasPosition = !!(stock.costPrice && stock.quantity)

        return (
          <div className="flex items-center gap-1">
            {/* K线图按钮 */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onOpenKLine(stock.id)}
              title={t('table.openChart')}
            >
              <LineChart className="h-4 w-4" />
            </Button>

            {/* 持仓按钮 */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onEditPosition(stock.id)}
              title={t('table.editPosition')}
            >
              <Wallet className="h-4 w-4" />
            </Button>

            {/* 更多操作菜单 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={removing === stock.id || moving === stock.id}
                >
                  {removing === stock.id || moving === stock.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MoreVertical className="h-4 w-4" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{t('list.actions')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {groups.length > 0 && (
                  <>
                    <DropdownMenuLabel className="text-xs text-muted-foreground">
                      {t('list.moveToGroup')}
                    </DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => onMove(stock.id, null)}>
                      <FolderInput className="mr-2 h-4 w-4" />
                      {t('list.noGroup')}
                    </DropdownMenuItem>
                    {groups.map((group) => (
                      <DropdownMenuItem
                        key={group.id}
                        onClick={() => onMove(stock.id, group.id)}
                        disabled={stock.groupId === group.id}
                      >
                        <FolderInput className="mr-2 h-4 w-4" />
                        {group.name}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => onRemove(stock.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t('list.remove')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
    },
  ]
}
