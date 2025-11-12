'use client'

import { toggleStockMonitoring } from '@/actions/monitors'
import { moveStockToGroup, unwatchStock } from '@/actions/stocks'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Switch } from '@/components/ui/switch'
import { useStockSubscription } from '@/hooks/use-stock-subscription'
import type { userStockGroups as groupsSchema } from '@/lib/db/schema'
import { calculateGridConfig, calculateWindowPositions } from '@/lib/kline-grid-layout'
import type { StockWithGroup } from '@/lib/tushare'
import { Bell, BellOff, FolderInput, LayoutGrid, LineChart, Loader2, MoreVertical, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { DraggableKLineDialog } from './DraggableKLineDialog'

interface WatchedStocksListProps {
  stocks: StockWithGroup[]
  groups: Array<typeof groupsSchema.$inferSelect>
  loading: boolean
  onStockRemoved: () => void
  onStockMoved: () => void
}

export function WatchedStocksList({
  stocks,
  groups,
  loading,
  onStockRemoved,
  onStockMoved,
}: WatchedStocksListProps) {
  const t = useTranslations('MyStocks')
  const tRealtime = useTranslations('StockRealtime')
  const [removing, setRemoving] = useState<string | null>(null)
  const [moving, setMoving] = useState<string | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)

  // K线图弹窗状态
  interface KLineDialogState {
    stockId: string
    isUserPositioned: boolean // 是否用户手动调整过
    position?: { x: number; y: number; width: number; height: number } // 当前位置
  }
  const [openKLineDialogs, setOpenKLineDialogs] = useState<KLineDialogState[]>([])

  // 使用WebSocket订阅股票数据
  const tsCodes = stocks.map((s) => s.tsCode)
  const { quotes: realtimeData, isConnected } = useStockSubscription(tsCodes)

  // 格式化数字
  const formatNumber = (num: number, decimals = 2) => {
    return num.toFixed(decimals)
  }

  // 格式化成交量
  const formatVolume = (volume: number) => {
    if (volume >= 10000) {
      return `${(volume / 10000 / 100).toFixed(2)}万`
    }
    return (volume / 100).toFixed(2)
  }

  // 格式化成交额
  const formatAmount = (amount: number) => {
    if (amount >= 100000000) {
      return `${(amount / 100000000).toFixed(2)}亿`
    }
    return amount.toFixed(2) + '万'
  }

  const handleRemove = async (stockId: string) => {
    setRemoving(stockId)
    try {
      const result = await unwatchStock({ stockId })
      if (result.success) {
        toast.success(t('list.removeSuccess'))
        onStockRemoved()
      } else {
        toast.error(t('list.removeError'), {
          description: result.error || 'Unknown error',
        })
      }
    } catch (error) {
      toast.error(t('list.removeError'), {
        description: String(error),
      })
    } finally {
      setRemoving(null)
    }
  }

  const handleMove = async (stockId: string, groupId: string | null) => {
    setMoving(stockId)
    try {
      const result = await moveStockToGroup({ stockId, groupId })
      if (result.success) {
        toast.success(t('list.moveSuccess'))
        onStockMoved()
      } else {
        toast.error(t('list.moveError'), {
          description: result.error || 'Unknown error',
        })
      }
    } catch (error) {
      toast.error(t('list.moveError'), {
        description: String(error),
      })
    } finally {
      setMoving(null)
    }
  }

  const handleToggleMonitoring = async (watchedStockId: string, currentStatus: boolean) => {
    setToggling(watchedStockId)
    try {
      const result = await toggleStockMonitoring({
        watchedStockId,
        monitored: !currentStatus,
      })
      if (result.success) {
        toast.success(!currentStatus ? t('list.monitoringEnabled') : t('list.monitoringDisabled'))
        onStockMoved()
      } else {
        toast.error(t('list.monitoringToggleError'), {
          description: result.error || 'Unknown error',
        })
      }
    } catch (error) {
      toast.error(t('list.monitoringToggleError'), {
        description: String(error),
      })
    } finally {
      setToggling(null)
    }
  }

  // 自动排列窗口函数
  const arrangeWindows = useCallback(
    (resetUserPositions = false) => {
      if (openKLineDialogs.length === 0) return

      const screenWidth = window.innerWidth
      const screenHeight = window.innerHeight
      const savedSize = localStorage.getItem('kline-dialog-size')
      const windowSize = savedSize ? JSON.parse(savedSize) : { width: 800, height: 600 }

      const gridConfig = calculateGridConfig(
        openKLineDialogs.length,
        screenWidth,
        screenHeight,
        windowSize
      )

      const positions = calculateWindowPositions(gridConfig, openKLineDialogs.length)

      setOpenKLineDialogs((prev) =>
        prev.map((dialog, index) => ({
          ...dialog,
          position:
            !dialog.isUserPositioned || resetUserPositions
              ? {
                  x: positions[index].x,
                  y: positions[index].y,
                  width: positions[index].width,
                  height: positions[index].height,
                }
              : dialog.position,
          isUserPositioned: resetUserPositions ? false : dialog.isUserPositioned,
        }))
      )
    },
    [openKLineDialogs]
  )

  // 打开K线图
  const handleOpenKLine = useCallback((stockId: string) => {
    setOpenKLineDialogs((prev) => {
      if (prev.find((d) => d.stockId === stockId)) {
        return prev // 已经打开，不重复添加
      }
      const newDialogs = [...prev, { stockId, isUserPositioned: false }]

      // 立即计算新的布局
      setTimeout(() => {
        const screenWidth = window.innerWidth
        const screenHeight = window.innerHeight
        const savedSize = localStorage.getItem('kline-dialog-size')
        const windowSize = savedSize ? JSON.parse(savedSize) : { width: 800, height: 600 }

        const gridConfig = calculateGridConfig(
          newDialogs.length,
          screenWidth,
          screenHeight,
          windowSize
        )

        const positions = calculateWindowPositions(gridConfig, newDialogs.length)

        setOpenKLineDialogs((current) =>
          current.map((dialog, index) => ({
            ...dialog,
            position: !dialog.isUserPositioned
              ? {
                  x: positions[index].x,
                  y: positions[index].y,
                  width: positions[index].width,
                  height: positions[index].height,
                }
              : dialog.position,
          }))
        )
      }, 0)

      return newDialogs
    })
  }, [])

  // 关闭K线图
  const handleCloseKLine = useCallback((stockId: string) => {
    setOpenKLineDialogs((prev) => {
      const newDialogs = prev.filter((d) => d.stockId !== stockId)

      // 立即计算新的布局
      if (newDialogs.length > 0) {
        setTimeout(() => {
          const screenWidth = window.innerWidth
          const screenHeight = window.innerHeight
          const savedSize = localStorage.getItem('kline-dialog-size')
          const windowSize = savedSize ? JSON.parse(savedSize) : { width: 800, height: 600 }

          const gridConfig = calculateGridConfig(
            newDialogs.length,
            screenWidth,
            screenHeight,
            windowSize
          )

          const positions = calculateWindowPositions(gridConfig, newDialogs.length)

          setOpenKLineDialogs((current) =>
            current.map((dialog, index) => ({
              ...dialog,
              position: !dialog.isUserPositioned
                ? {
                    x: positions[index].x,
                    y: positions[index].y,
                    width: positions[index].width,
                    height: positions[index].height,
                  }
                : dialog.position,
            }))
          )
        }, 0)
      }

      return newDialogs
    })
  }, [])

  // 手动拖拽回调
  const handleDialogDragEnd = useCallback(
    (stockId: string, position: { x: number; y: number }) => {
      setOpenKLineDialogs((prev) =>
        prev.map((d) =>
          d.stockId === stockId
            ? { ...d, position: { ...d.position!, x: position.x, y: position.y }, isUserPositioned: true }
            : d
        )
      )
    },
    []
  )

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (stocks.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center h-64 text-center">
          <p className="text-muted-foreground">{t('list.empty')}</p>
          <p className="text-sm text-muted-foreground mt-2">{t('list.emptyHint')}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* WebSocket连接状态提示 + 整理窗口按钮 */}
      <div className="flex items-center justify-between gap-4">
        {!isConnected && stocks.length > 0 && (
          <Card className="bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-900 flex-1">
            <CardContent className="flex items-center gap-2 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-yellow-600 dark:text-yellow-400" />
              <span className="text-sm text-yellow-600 dark:text-yellow-400">
                正在连接实时行情服务...
              </span>
            </CardContent>
          </Card>
        )}
        {openKLineDialogs.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => arrangeWindows(true)}
            title={t('kline.arrangeWindows')}
          >
            <LayoutGrid className="h-4 w-4 mr-2" />
            {t('kline.arrangeWindows')}
          </Button>
        )}
      </div>

      {stocks.map((stock) => {
        const quote = realtimeData.get(stock.tsCode)
        const isPositive = quote ? quote.change >= 0 : false
        const changeColor = isPositive
          ? 'text-red-600 dark:text-red-400'
          : 'text-green-600 dark:text-green-400'

        return (
          <Card key={stock.id} className="overflow-hidden gap-0">
            <CardHeader className="pb-0">
              <div className="flex items-start justify-between">
                <div className="space-y-1 flex-1">
                  <div className="flex items-baseline gap-3">
                    <CardTitle className="text-base">
                      {stock.name}{' '}
                      <span className="text-muted-foreground font-normal text-sm">
                        ({stock.symbol})
                      </span>
                    </CardTitle>
                    {/* 实时价格显示 */}
                    {quote && (
                      <div className="flex items-baseline gap-2">
                        <span className={`text-xl font-bold ${changeColor}`}>
                          {formatNumber(quote.currentPrice)}
                        </span>
                        <span className={`text-sm font-semibold ${changeColor}`}>
                          {isPositive ? '+' : ''}
                          {formatNumber(quote.changePercent)}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* K线图按钮 */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleOpenKLine(stock.id)}
                    title={t('kline.openChart')}
                  >
                    <LineChart className="h-4 w-4" />
                  </Button>

                  {/* 监控开关 */}
                  <div className="flex items-center gap-2">
                    {stock.monitored ? (
                      <Bell className="h-4 w-4 text-primary" />
                    ) : (
                      <BellOff className="h-4 w-4 text-muted-foreground" />
                    )}
                    <Switch
                      checked={stock.monitored}
                      onCheckedChange={() => handleToggleMonitoring(stock.id, stock.monitored)}
                      disabled={toggling === stock.id}
                    />
                  </div>

                  {/* 操作菜单 */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
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
                          <DropdownMenuItem onClick={() => handleMove(stock.id, null)}>
                            <FolderInput className="mr-2 h-4 w-4" />
                            {t('list.noGroup')}
                          </DropdownMenuItem>
                          {groups.map((group) => (
                            <DropdownMenuItem
                              key={group.id}
                              onClick={() => handleMove(stock.id, group.id)}
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
                        onClick={() => handleRemove(stock.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {t('list.remove')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardHeader>
            <CardContent className="">
              <div className="space-y-1">
                {/* 实时行情详情 */}
                {quote && (
                  <div className="border rounded-lg overflow-hidden bg-background">
                    <div className="px-2 pb-2 pt-2">
                      {/* PC端4列，移动端2列 */}
                      <div className="grid grid-cols-2 lg:grid-cols-6 gap-x-3 gap-y-0.5 text-xs">
                        <div className="flex justify-between py-0.5">
                          <span className="text-muted-foreground">{tRealtime('open')}</span>
                          <span className="font-medium">{formatNumber(quote.open)}</span>
                        </div>
                        <div className="flex justify-between py-0.5">
                          <span className="text-muted-foreground">{tRealtime('high')}</span>
                          <span className="font-medium text-red-600">
                            {formatNumber(quote.high)}
                          </span>
                        </div>
                        <div className="flex justify-between py-0.5">
                          <span className="text-muted-foreground">{tRealtime('low')}</span>
                          <span className="font-medium text-green-600">
                            {formatNumber(quote.low)}
                          </span>
                        </div>
                        <div className="flex justify-between py-0.5">
                          <span className="text-muted-foreground">{tRealtime('preClose')}</span>
                          <span className="font-medium">{formatNumber(quote.preClose)}</span>
                        </div>
                        <div className="flex justify-between py-0.5">
                          <span className="text-muted-foreground">{tRealtime('volume')}</span>
                          <span className="font-medium">{formatVolume(quote.volume)}手</span>
                        </div>
                        <div className="flex justify-between py-0.5">
                          <span className="text-muted-foreground">{tRealtime('amount')}</span>
                          <span className="font-medium">{formatAmount(quote.amount)}元</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}

      {/* 渲染所有打开的K线图弹窗 */}
      {openKLineDialogs.map((dialog) => {
        const stock = stocks.find((s) => s.id === dialog.stockId)
        if (!stock) return null
        return (
          <DraggableKLineDialog
            key={dialog.stockId}
            open={true}
            onOpenChange={(open) => {
              if (!open) handleCloseKLine(dialog.stockId)
            }}
            onDragEnd={(pos) => handleDialogDragEnd(dialog.stockId, pos)}
            autoPosition={dialog.position}
            enableTransition={!dialog.isUserPositioned}
            stockName={stock.name}
            stockCode={stock.symbol}
            tsCode={stock.tsCode}
          />
        )
      })}
    </div>
  )
}
