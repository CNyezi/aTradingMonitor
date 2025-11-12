'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { AlertState } from '@/lib/monitors/types'
import { AlertCircle, Bell, TrendingDown, TrendingUp, Activity } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

interface RealtimeAlertsListProps {
  alerts: Array<{ alertKey: string; state: AlertState }>
}

/**
 * 实时活跃告警列表组件
 * 展示当前正在活跃的告警(OPEN/ACTIVE状态)
 */
export function RealtimeAlertsList({ alerts }: RealtimeAlertsListProps) {
  // 按状态分组
  const openAlerts = alerts.filter((a) => a.state.status === 'OPEN')
  const activeAlerts = alerts.filter((a) => a.state.status === 'ACTIVE')

  const getAlertTypeIcon = (alertType: string) => {
    switch (alertType) {
      case 'limit_up':
        return <TrendingUp className="h-4 w-4 text-red-500" />
      case 'limit_down':
        return <TrendingDown className="h-4 w-4 text-green-500" />
      case 'price_change':
        return <TrendingUp className="h-4 w-4 text-orange-500" />
      case 'volume_spike':
        return <Activity className="h-4 w-4 text-blue-500" />
      case 'price_breakout':
        return <AlertCircle className="h-4 w-4 text-purple-500" />
      default:
        return <Bell className="h-4 w-4" />
    }
  }

  const getAlertTypeName = (alertType: string) => {
    switch (alertType) {
      case 'limit_up':
        return '涨停'
      case 'limit_down':
        return '跌停'
      case 'price_change':
        return '价格波动'
      case 'volume_spike':
        return '成交量激增'
      case 'price_breakout':
        return '价格突破'
      default:
        return alertType
    }
  }

  const getStatusBadge = (status: AlertState['status']) => {
    switch (status) {
      case 'OPEN':
        return (
          <Badge variant="destructive" className="animate-pulse">
            新告警
          </Badge>
        )
      case 'ACTIVE':
        return <Badge variant="secondary">活跃中</Badge>
      case 'CLOSED':
        return <Badge variant="outline">已关闭</Badge>
    }
  }

  if (alerts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            实时活跃告警
          </CardTitle>
          <CardDescription>当前触发的告警会实时显示在这里</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Bell className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">暂无活跃告警</p>
            <p className="text-xs text-muted-foreground mt-2">
              告警触发后会立即显示在这里，关闭条件满足后自动消失
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          实时活跃告警 <Badge variant="default">{alerts.length}</Badge>
        </CardTitle>
        <CardDescription>
          {openAlerts.length > 0 && <span className="text-red-600 font-medium">{openAlerts.length} 个新告警</span>}
          {openAlerts.length > 0 && activeAlerts.length > 0 && ' • '}
          {activeAlerts.length > 0 && <span>{activeAlerts.length} 个活跃告警</span>}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.map(({ alertKey, state }) => {
          // 解析 alertKey: "stockCode:alertType"
          const [stockCode, alertType] = alertKey.split(':')
          const { status, openTime, triggerData } = state

          return (
            <div
              key={alertKey}
              className={`flex items-start gap-3 p-3 border rounded-lg transition-all ${
                status === 'OPEN'
                  ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900'
                  : 'bg-muted/50 border-muted'
              }`}
            >
              <div className="mt-1">{getAlertTypeIcon(alertType)}</div>

              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{stockCode}</span>
                  {getStatusBadge(status)}
                  <span className="text-sm text-muted-foreground">{getAlertTypeName(alertType)}</span>
                </div>

                <div className="text-sm text-muted-foreground">{triggerData.message}</div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>
                    触发时间:{' '}
                    {formatDistanceToNow(new Date(openTime), {
                      addSuffix: true,
                      locale: zhCN,
                    })}
                  </span>
                  <span>当前价: ¥{triggerData.currentPrice.toFixed(2)}</span>
                  <span
                    className={triggerData.changePercent >= 0 ? 'text-red-600' : 'text-green-600'}
                  >
                    {triggerData.changePercent >= 0 ? '+' : ''}
                    {triggerData.changePercent.toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>
          )
        })}

        <div className="text-xs text-muted-foreground pt-2 border-t">
          <p>• 新告警: 刚触发的告警，会发送通知</p>
          <p>• 活跃中: 条件持续满足，但不会重复通知</p>
          <p>• 告警会在条件恢复后自动关闭(回落到触发阈值的 95% 以下)</p>
        </div>
      </CardContent>
    </Card>
  )
}
