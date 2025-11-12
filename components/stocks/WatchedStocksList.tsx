'use client'

import { toggleStockMonitoring, getUserMonitorRules, getStockRules } from '@/actions/monitors'
import { moveStockToGroup, unwatchStock } from '@/actions/stocks'
import { Button } from '@/components/ui/button'
import { useStockSubscription } from '@/hooks/use-stock-subscription'
import type { userStockGroups as groupsSchema } from '@/lib/db/schema'
import { calculateGridConfig, calculateWindowPositions } from '@/lib/kline-grid-layout'
import type { StockWithGroup } from '@/lib/tushare'
import { LayoutGrid } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useState, useEffect } from 'react'
import { toast } from 'sonner'
import { DraggableKLineDialog } from './DraggableKLineDialog'
import { StockRuleSelectorDialog } from '@/components/monitors/StockRuleSelectorDialog'
import { EditPositionDialog } from './EditPositionDialog'
import { WatchedStocksTable } from './table'

interface WatchedStocksListProps {
  stocks: StockWithGroup[]
  groups: Array<typeof groupsSchema.$inferSelect>
  loading: boolean
  onStockRemoved: () => void
  onStockMoved: () => void
  onMonitoringChange?: () => void
}

export function WatchedStocksList({
  stocks,
  groups,
  loading,
  onStockRemoved,
  onStockMoved,
  onMonitoringChange,
}: WatchedStocksListProps) {
  const t = useTranslations('MyStocks')
  const [removing, setRemoving] = useState<string | null>(null)
  const [moving, setMoving] = useState<string | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)

  // 规则选择相关状态
  const [allRules, setAllRules] = useState<any[]>([])
  const [selectedStockForRules, setSelectedStockForRules] = useState<string | null>(null)
  const [stockRuleCounts, setStockRuleCounts] = useState<Map<string, number>>(new Map())

  // 持仓编辑相关状态
  const [editingPositionStock, setEditingPositionStock] = useState<string | null>(null)

  // K线图弹窗状态
  interface KLineDialogState {
    stockId: string
    isUserPositioned: boolean
    position?: { x: number; y: number; width: number; height: number }
  }
  const [openKLineDialogs, setOpenKLineDialogs] = useState<KLineDialogState[]>([])

  // 使用WebSocket订阅股票数据
  const tsCodes = stocks.map((s) => s.tsCode)
  const { quotes: realtimeData, isConnected } = useStockSubscription(tsCodes)

  // 加载规则列表
  useEffect(() => {
    loadRules()
  }, [])

  const loadRules = async () => {
    const result = await getUserMonitorRules()
    if (result.success && result.data && typeof result.data === 'object' && 'rules' in result.data) {
      setAllRules((result.data.rules as any[]) || [])
    }
  }

  // 加载每只股票的规则数量
  useEffect(() => {
    if (stocks.length > 0) {
      loadStockRuleCounts()
    }
  }, [stocks])

  const loadStockRuleCounts = async () => {
    const counts = new Map<string, number>()
    await Promise.all(
      stocks.map(async (stock) => {
        const result = await getStockRules(stock.id)
        if (result.success && result.data && typeof result.data === 'object' && 'associations' in result.data) {
          counts.set(stock.id, (result.data.associations as any[])?.length || 0)
        }
      })
    )
    setStockRuleCounts(counts)
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
        return prev
      }
      const newDialogs = [...prev, { stockId, isUserPositioned: false }]

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

  // 转换groups格式以匹配Table组件的要求
  const formattedGroups = groups.map((g) => ({ id: g.id, name: g.name }))

  return (
    <div className="space-y-4">
      {/* 整理窗口按钮 */}
      {openKLineDialogs.length > 0 && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => arrangeWindows(true)}
            title={t('kline.arrangeWindows')}
          >
            <LayoutGrid className="h-4 w-4 mr-2" />
            {t('kline.arrangeWindows')}
          </Button>
        </div>
      )}

      {/* 主表格组件 */}
      <WatchedStocksTable
        stocks={stocks}
        realtimeData={realtimeData}
        loading={loading}
        isConnected={isConnected}
        stockRuleCounts={stockRuleCounts}
        toggling={toggling}
        removing={removing}
        moving={moving}
        onToggleMonitoring={handleToggleMonitoring}
        onOpenRules={(id) => setSelectedStockForRules(id)}
        onOpenKLine={handleOpenKLine}
        onEditPosition={(id) => setEditingPositionStock(id)}
        onMove={handleMove}
        onRemove={handleRemove}
        groups={formattedGroups}
      />

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

      {/* 规则选择对话框 */}
      {selectedStockForRules && (
        <StockRuleSelectorDialog
          open={true}
          onOpenChange={(open) => !open && setSelectedStockForRules(null)}
          watchedStockId={selectedStockForRules}
          stockName={stocks.find((s) => s.id === selectedStockForRules)?.name || ''}
          stockCode={stocks.find((s) => s.id === selectedStockForRules)?.tsCode || ''}
          availableRules={allRules}
          onRulesChanged={() => {
            loadStockRuleCounts()
            onMonitoringChange?.()
          }}
        />
      )}

      {/* 持仓编辑对话框 */}
      {editingPositionStock && (() => {
        const stock = stocks.find((s) => s.id === editingPositionStock)
        if (!stock) return null
        return (
          <EditPositionDialog
            open={true}
            onOpenChange={(open) => !open && setEditingPositionStock(null)}
            watchedStockId={stock.id}
            stockName={stock.name}
            stockCode={stock.symbol}
            initialCostPrice={stock.costPrice}
            initialQuantity={stock.quantity}
            onPositionUpdated={() => {
              onStockMoved()
            }}
          />
        )
      })()}
    </div>
  )
}
