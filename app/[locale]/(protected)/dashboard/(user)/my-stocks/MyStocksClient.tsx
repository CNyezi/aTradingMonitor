'use client'

import { getUserMonitorRules } from '@/actions/monitors'
import { getUserStockGroups, getWatchedStocks } from '@/actions/stocks'
import { RealtimeAlertsList } from '@/components/monitors/RealtimeAlertsList'
import { StockGroupManager } from '@/components/stocks/StockGroupManager'
import { StockSearchDialog } from '@/components/stocks/StockSearchDialog'
import { UpdateStocksButton } from '@/components/stocks/UpdateStocksButton'
import { WatchedStocksList } from '@/components/stocks/WatchedStocksList'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useRealtimeMonitor } from '@/hooks/use-realtime-monitor'
import { authClient } from '@/lib/auth/auth-client'
import type { userStockGroups as groupsSchema } from '@/lib/db/schema'
import type { StockWithGroup } from '@/lib/tushare'
import { Bell, BellOff, HelpCircle, Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'

export default function MyStocksClient() {
  const t = useTranslations('MyStocks')
  const { data: session } = authClient.useSession()
  const user = session?.user as any | undefined
  const isAdmin = user?.role === 'admin'
  const [searchDialogOpen, setSearchDialogOpen] = useState(false)
  const [watchedStocks, setWatchedStocks] = useState<StockWithGroup[]>([])
  const [groups, setGroups] = useState<Array<typeof groupsSchema.$inferSelect>>([])
  const [selectedGroupId, setSelectedGroupId] = useState<string | null | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [monitorRules, setMonitorRules] = useState<any[]>([])

  // 启动实时监控引擎 - 传入开启监控的股票列表
  // 使用 useMemo 避免每次渲染都创建新数组引用
  const monitoredStocks = useMemo(
    () => watchedStocks.filter((stock) => stock.monitored),
    [watchedStocks]
  )

  const { notificationPermission, requestNotificationPermission, getActiveAlerts } =
    useRealtimeMonitor(monitoredStocks)

  // 活跃告警状态 (每3秒刷新一次以更新UI)
  const [activeAlerts, setActiveAlerts] = useState<ReturnType<typeof getActiveAlerts>>([])

  useEffect(() => {
    // 立即获取一次
    setActiveAlerts(getActiveAlerts())

    // 每3秒刷新一次告警列表
    const interval = setInterval(() => {
      setActiveAlerts(getActiveAlerts())
    }, 3000)

    return () => clearInterval(interval)
  }, [getActiveAlerts])

  // 加载数据
  const loadData = async () => {
    setLoading(true)
    try {
      const [stocksResult, groupsResult, rulesResult] = await Promise.all([
        getWatchedStocks({ groupId: selectedGroupId }),
        getUserStockGroups(),
        getUserMonitorRules(),
      ])

      if (stocksResult.success && stocksResult.data) {
        setWatchedStocks(stocksResult.data.stocks)
      }

      if (groupsResult.success && groupsResult.data) {
        setGroups(groupsResult.data.groups)
      }

      if (
        rulesResult.success &&
        rulesResult.data &&
        typeof rulesResult.data === 'object' &&
        'rules' in rulesResult.data
      ) {
        setMonitorRules(rulesResult.data.rules as any[])
      }
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [selectedGroupId])

  // 统计监控中的股票数量
  const monitoredCount = watchedStocks.filter((stock) => stock.monitored).length
  const totalCount = watchedStocks.length

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 头部 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground mt-1">{t('description')}</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && <UpdateStocksButton onSuccess={loadData} />}
          <Button onClick={() => setSearchDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t('addStock')}
          </Button>
        </div>
      </div>

      {/* 精简的监控状态和活跃告警 */}
      <div className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg border mb-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-sm">
              <div className="space-y-1 text-xs">
                <p>• 实时监控引擎会自动检查开启监控的股票的波动情况</p>
                <p>• 触发告警时会通过 Toast 和桌面通知提醒您</p>
                <p>• 告警具有 5 分钟冷却期，避免重复通知</p>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="flex items-center gap-6 text-sm">
          <span className="text-muted-foreground">
            监控: <span className="font-medium text-foreground">{monitoredCount}/{totalCount}</span>
          </span>
          <span className="text-muted-foreground">
            规则: <span className="font-medium text-foreground">{monitorRules.filter((r) => r.enabled).length}</span>
          </span>
          <span className="text-muted-foreground">
            活跃告警: <span className="font-bold text-red-600">{activeAlerts.length}</span>
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {notificationPermission === 'granted' ? (
            <>
              <Bell className="h-4 w-4 text-green-600" />
              <span className="text-xs text-green-600">通知已启用</span>
            </>
          ) : notificationPermission === 'denied' ? (
            <>
              <BellOff className="h-4 w-4 text-red-600" />
              <span className="text-xs text-red-600">通知已禁用</span>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={requestNotificationPermission}>
              <Bell className="mr-1 h-3 w-3" />
              启用通知
            </Button>
          )}
        </div>
      </div>

      {/* 实时活跃告警列表 */}
      {activeAlerts.length > 0 && <RealtimeAlertsList alerts={activeAlerts} />}

      {/* 分组管理 - 顶部 */}
      <StockGroupManager
        groups={groups}
        selectedGroupId={selectedGroupId}
        onSelectGroup={setSelectedGroupId}
        onGroupsChange={loadData}
      />

      {/* 股票列表 */}
      <WatchedStocksList
        stocks={watchedStocks}
        groups={groups}
        loading={loading}
        onStockRemoved={loadData}
        onStockMoved={loadData}
      />

      {/* 搜索对话框 */}
      <StockSearchDialog
        open={searchDialogOpen}
        onOpenChange={setSearchDialogOpen}
        groups={groups}
        onStockAdded={loadData}
      />
    </div>
  )
}
