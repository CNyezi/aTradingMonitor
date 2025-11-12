'use client'

import {
  ColumnPinningState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { StockWithGroup } from '@/lib/tushare'
import type { RealtimeQuote } from '@/lib/websocket/types'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import { createColumns, type StockTableRow } from './columns'
import { EmptyState } from './EmptyState'
import { LoadingState } from './LoadingState'
import { TableToolbar } from './TableToolbar'
import { SummaryStats } from './SummaryStats'
import { Loader2 } from 'lucide-react'

interface WatchedStocksTableProps {
  stocks: StockWithGroup[]
  realtimeData: Map<string, RealtimeQuote>
  loading: boolean
  isConnected: boolean
  stockRuleCounts: Map<string, number>
  toggling: string | null
  removing: string | null
  moving: string | null
  onToggleMonitoring: (stockId: string, currentStatus: boolean) => void
  onOpenRules: (stockId: string) => void
  onOpenKLine: (stockId: string) => void
  onEditPosition: (stockId: string) => void
  onMove: (stockId: string, groupId: string | null) => void
  onRemove: (stockId: string) => void
  onAddStock?: () => void
  groups: Array<{ id: string; name: string }>
}

export function WatchedStocksTable({
  stocks,
  realtimeData,
  loading,
  isConnected,
  stockRuleCounts,
  toggling,
  removing,
  moving,
  onToggleMonitoring,
  onOpenRules,
  onOpenKLine,
  onEditPosition,
  onMove,
  onRemove,
  onAddStock,
  groups,
}: WatchedStocksTableProps) {
  const t = useTranslations('MyStocks')

  // 金额可见性状态
  const [isAmountVisible, setIsAmountVisible] = useState(true)

  // 从 localStorage 加载金额可见性设置
  useEffect(() => {
    const saved = localStorage.getItem('stockAmountVisible')
    if (saved !== null) {
      setIsAmountVisible(saved === 'true')
    }
  }, [])

  // 切换金额可见性
  const toggleAmountVisibility = () => {
    const newValue = !isAmountVisible
    setIsAmountVisible(newValue)
    localStorage.setItem('stockAmountVisible', String(newValue))
  }

  // 表格状态
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'changePercent', desc: true }, // 默认按涨跌幅降序
  ])
  const [globalFilter, setGlobalFilter] = useState('')
  const [columnPinning] = useState<ColumnPinningState>({
    left: ['name', 'currentPrice'], // 固定股票名称和价格列
  })

  // 转换数据格式，将实时数据合并到每一行
  const tableData: StockTableRow[] = useMemo(() => {
    return stocks.map((stock) => ({
      ...stock,
      quote: realtimeData.get(stock.tsCode),
    }))
  }, [stocks, realtimeData])

  // 创建列配置
  const columns = useMemo(
    () =>
      createColumns({
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
      }),
    [
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
    ]
  )


  // 创建表格实例
  const table = useReactTable({
    data: tableData,
    columns,
    state: {
      sorting,
      globalFilter,
      columnPinning,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, columnId, filterValue) => {
      const stock = row.original
      const searchStr = filterValue.toLowerCase()
      return (
        stock.name.toLowerCase().includes(searchStr) ||
        stock.symbol.toLowerCase().includes(searchStr) ||
        stock.tsCode.toLowerCase().includes(searchStr)
      )
    },
  })

  // 加载状态
  if (loading) {
    return <LoadingState />
  }

  // 空状态
  if (stocks.length === 0) {
    return (
      <Card>
        <CardContent className="p-0">
          <EmptyState onAddStock={onAddStock} />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* WebSocket连接状态提示 */}
      {!isConnected && stocks.length > 0 && (
        <Card className="bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-900">
          <CardContent className="flex items-center gap-2 py-3">
            <Loader2 className="h-4 w-4 animate-spin text-yellow-600 dark:text-yellow-400" />
            <span className="text-sm text-yellow-600 dark:text-yellow-400">
              {t('table.connecting')}
            </span>
          </CardContent>
        </Card>
      )}

      {/* 工具栏 */}
      <TableToolbar
        globalFilter={globalFilter}
        setGlobalFilter={setGlobalFilter}
        stockCount={table.getFilteredRowModel().rows.length}
      />

      {/* 统计信息 - 紧凑单行 */}
      <SummaryStats
        stocks={stocks}
        realtimeData={realtimeData}
        isAmountVisible={isAmountVisible}
        onToggleVisibility={toggleAmountVisibility}
      />

      {/* 表格容器 */}
      <div className="rounded-md border overflow-auto">
        <div className="relative">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const meta = header.column.columnDef.meta as { className?: string } | undefined
                    return (
                      <TableHead
                        key={header.id}
                        className={meta?.className}
                        style={{
                          width: header.getSize(),
                          minWidth: header.column.columnDef.minSize,
                          maxWidth: header.column.columnDef.maxSize,
                          position: header.column.getIsPinned() ? 'sticky' : 'relative',
                          left:
                            header.column.getIsPinned() === 'left'
                              ? `${header.column.getStart('left')}px`
                              : undefined,
                          right:
                            header.column.getIsPinned() === 'right'
                              ? `${header.column.getAfter('right')}px`
                              : undefined,
                          zIndex: header.column.getIsPinned() ? 20 : 1,
                          backgroundColor: 'hsl(var(--background))',
                          boxShadow:
                            header.column.getIsPinned() === 'left' &&
                            header.column.getIsLastColumn('left')
                              ? '2px 0 4px -2px rgba(0, 0, 0, 0.1)'
                              : header.column.getIsPinned() === 'right' &&
                                  header.column.getIsFirstColumn('right')
                                ? '-2px 0 4px -2px rgba(0, 0, 0, 0.1)'
                                : undefined,
                        }}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                    {row.getVisibleCells().map((cell) => {
                      const meta = cell.column.columnDef.meta as { className?: string } | undefined
                      return (
                        <TableCell
                          key={cell.id}
                          className={meta?.className}
                          style={{
                            width: cell.column.getSize(),
                            minWidth: cell.column.columnDef.minSize,
                            maxWidth: cell.column.columnDef.maxSize,
                            position: cell.column.getIsPinned() ? 'sticky' : 'relative',
                            left:
                              cell.column.getIsPinned() === 'left'
                                ? `${cell.column.getStart('left')}px`
                                : undefined,
                            right:
                              cell.column.getIsPinned() === 'right'
                                ? `${cell.column.getAfter('right')}px`
                                : undefined,
                            zIndex: cell.column.getIsPinned() ? 20 : 1,
                            backgroundColor: 'hsl(var(--background))',
                            boxShadow:
                              cell.column.getIsPinned() === 'left' &&
                              cell.column.getIsLastColumn('left')
                                ? '2px 0 4px -2px rgba(0, 0, 0, 0.1)'
                                : cell.column.getIsPinned() === 'right' &&
                                    cell.column.getIsFirstColumn('right')
                                  ? '-2px 0 4px -2px rgba(0, 0, 0, 0.1)'
                                  : undefined,
                          }}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    {t('list.empty')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
