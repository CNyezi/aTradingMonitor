'use client'

import { getUserStockGroups, getWatchedStocks } from '@/actions/stocks'
import { getUserMonitorRules } from '@/actions/monitors'
import { StockGroupManager } from '@/components/stocks/StockGroupManager'
import { StockSearchDialog } from '@/components/stocks/StockSearchDialog'
import { UpdateStocksButton } from '@/components/stocks/UpdateStocksButton'
import { WatchedStocksList } from '@/components/stocks/WatchedStocksList'
import { RealtimeAlertsList } from '@/components/monitors/RealtimeAlertsList'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { userStockGroups as groupsSchema } from '@/lib/db/schema'
import type { StockWithGroup } from '@/lib/tushare'
import { authClient } from '@/lib/auth/auth-client'
import { useRealtimeMonitor } from '@/hooks/use-realtime-monitor'
import { Bell, BellOff, Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

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

  // 准备监控规则数据 - 将全局规则应用到每只开启监控的股票
  const monitorRulesWithStocks = watchedStocks
    .filter((stock) => stock.monitored) // 只监控已开启监控的股票
    .flatMap((stock) =>
      monitorRules
        .filter((rule) => rule.enabled)
        .map((rule) => ({
          id: `${stock.id}-${rule.id}`, // 组合ID
          stockCode: stock.tsCode,
          ruleType: rule.ruleType,
          ruleName: rule.ruleName,
          enabled: true,
          config: rule.config,
        }))
    )

  // 启动实时监控引擎
  const { notificationPermission, requestNotificationPermission, getActiveAlerts } =
    useRealtimeMonitor(monitorRulesWithStocks)

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

      if (rulesResult.success && rulesResult.data && 'rules' in rulesResult.data) {
        setMonitorRules(rulesResult.data.rules)
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

      {/* 实时监控状态卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            实时监控状态
          </CardTitle>
          <CardDescription>基于 WebSocket 实时推送的股票波动监控</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">监控规则</p>
              <p className="text-2xl font-bold">{monitorRules.filter((r) => r.enabled).length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">监控股票</p>
              <p className="text-2xl font-bold">
                {monitoredCount} / {totalCount}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">活跃告警</p>
              <p className="text-2xl font-bold text-red-600">{activeAlerts.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">桌面通知</p>
              <div className="flex items-center gap-2 mt-1">
                {notificationPermission === 'granted' ? (
                  <>
                    <Bell className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-green-600">已启用</span>
                  </>
                ) : notificationPermission === 'denied' ? (
                  <>
                    <BellOff className="h-4 w-4 text-red-600" />
                    <span className="text-sm text-red-600">已禁用</span>
                  </>
                ) : (
                  <Button size="sm" variant="outline" onClick={requestNotificationPermission}>
                    <Bell className="mr-1 h-3 w-3" />
                    启用通知
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="text-xs text-muted-foreground space-y-1">
            <p>• 实时监控引擎会自动检查开启监控的股票的波动情况</p>
            <p>• 触发告警时会通过 Toast 和桌面通知提醒您</p>
            <p>• 告警具有 5 分钟冷却期，避免重复通知</p>
          </div>
        </CardContent>
      </Card>

      {/* 实时活跃告警列表 */}
      <RealtimeAlertsList alerts={activeAlerts} />

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
