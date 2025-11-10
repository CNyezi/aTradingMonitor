'use client'

import { moveStockToGroup, unwatchStock } from '@/actions/stocks'
import { toggleStockMonitoring } from '@/actions/monitors'
import { Badge } from '@/components/ui/badge'
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
import { Label } from '@/components/ui/label'
import type { userStockGroups as groupsSchema } from '@/lib/db/schema'
import type { StockWithGroup } from '@/lib/tushare'
import { Bell, BellOff, FolderInput, Loader2, MoreVertical, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'

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
  const [removing, setRemoving] = useState<string | null>(null)
  const [moving, setMoving] = useState<string | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)

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
        toast.success(
          !currentStatus ? t('list.monitoringEnabled') : t('list.monitoringDisabled')
        )
        onStockMoved() // 刷新列表
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
      {stocks.map((stock) => (
        <Card key={stock.id}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <CardTitle className="text-lg">
                  {stock.name} ({stock.symbol})
                </CardTitle>
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="outline">{stock.tsCode}</Badge>
                  {stock.industry && <Badge variant="secondary">{stock.industry}</Badge>}
                  {stock.area && <Badge variant="secondary">{stock.area}</Badge>}
                  {stock.market && <Badge variant="secondary">{stock.market}</Badge>}
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" disabled={removing === stock.id || moving === stock.id}>
                    {(removing === stock.id || moving === stock.id) ? (
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
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                {t('list.addedAt')}: {new Date(stock.addedAt).toLocaleDateString()}
                {stock.groupName && ` • ${t('list.group')}: ${stock.groupName}`}
                {stock.listDate && ` • ${t('list.listDate')}: ${stock.listDate}`}
              </div>

              {/* 监控开关 */}
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  {stock.monitored ? (
                    <Bell className="h-4 w-4 text-primary" />
                  ) : (
                    <BellOff className="h-4 w-4 text-muted-foreground" />
                  )}
                  <div>
                    <Label className="font-medium cursor-pointer">
                      {t('list.monitoring')}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {stock.monitored ? t('list.monitoringEnabledHint') : t('list.monitoringDisabledHint')}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={stock.monitored}
                  onCheckedChange={() => handleToggleMonitoring(stock.id, stock.monitored)}
                  disabled={toggling === stock.id}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
