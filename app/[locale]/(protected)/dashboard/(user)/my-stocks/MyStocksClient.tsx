'use client'

import { getUserStockGroups, getWatchedStocks } from '@/actions/stocks'
import { StockGroupManager } from '@/components/stocks/StockGroupManager'
import { StockSearchDialog } from '@/components/stocks/StockSearchDialog'
import { UpdateStocksButton } from '@/components/stocks/UpdateStocksButton'
import { WatchedStocksList } from '@/components/stocks/WatchedStocksList'
import { Button } from '@/components/ui/button'
import type { userStockGroups as groupsSchema } from '@/lib/db/schema'
import type { StockWithGroup } from '@/lib/tushare'
import { authClient } from '@/lib/auth/auth-client'
import { Plus } from 'lucide-react'
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

  // 加载数据
  const loadData = async () => {
    setLoading(true)
    try {
      const [stocksResult, groupsResult] = await Promise.all([
        getWatchedStocks({ groupId: selectedGroupId }),
        getUserStockGroups(),
      ])

      if (stocksResult.success && stocksResult.data) {
        setWatchedStocks(stocksResult.data.stocks)
      }

      if (groupsResult.success && groupsResult.data) {
        setGroups(groupsResult.data.groups)
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
