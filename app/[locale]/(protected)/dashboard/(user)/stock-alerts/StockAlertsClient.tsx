'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { getUserAlerts, markAlertAsRead, markAllAlertsAsRead } from '@/actions/monitors'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Bell, BellOff, Check, CheckCheck, Loader2, TrendingDown, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { zhCN, enUS, ja } from 'date-fns/locale'
import { useLocale } from 'next-intl'

interface Alert {
  id: string
  stockId: string
  stockCode: string
  stockName: string
  alertType: 'price_change' | 'volume_spike' | 'limit_up' | 'limit_down' | 'price_breakout'
  triggerTime: Date
  triggerData: any
  read: boolean
  notified: boolean
  createdAt: Date
}

export default function StockAlertsClient() {
  const t = useTranslations('StockAlerts')
  const locale = useLocale()
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [markingRead, setMarkingRead] = useState<string | null>(null)
  const [markingAllRead, setMarkingAllRead] = useState(false)

  const dateLocale = locale === 'zh' ? zhCN : locale === 'ja' ? ja : enUS

  const loadAlerts = async () => {
    setLoading(true)
    try {
      const result = await getUserAlerts({
        read: filter === 'unread' ? false : undefined,
        limit: 100,
      })

      if (result.success && result.data) {
        setAlerts(result.data.alerts)
      } else {
        toast.error(t('loadError'))
      }
    } catch (error) {
      toast.error(t('loadError'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAlerts()
  }, [filter])

  const handleMarkAsRead = async (alertId: string) => {
    setMarkingRead(alertId)
    try {
      const result = await markAlertAsRead(alertId)
      if (result.success) {
        await loadAlerts()
        toast.success(t('markReadSuccess'))
      } else {
        toast.error(t('markReadError'))
      }
    } catch (error) {
      toast.error(t('markReadError'))
    } finally {
      setMarkingRead(null)
    }
  }

  const handleMarkAllAsRead = async () => {
    setMarkingAllRead(true)
    try {
      const result = await markAllAlertsAsRead()
      if (result.success) {
        await loadAlerts()
        toast.success(t('markAllReadSuccess'))
      } else {
        toast.error(t('markAllReadError'))
      }
    } catch (error) {
      toast.error(t('markAllReadError'))
    } finally {
      setMarkingAllRead(false)
    }
  }

  const getAlertTypeIcon = (type: Alert['alertType']) => {
    switch (type) {
      case 'limit_up':
        return <TrendingUp className="h-4 w-4 text-red-500" />
      case 'limit_down':
        return <TrendingDown className="h-4 w-4 text-green-500" />
      case 'price_change':
        return <TrendingUp className="h-4 w-4 text-orange-500" />
      case 'volume_spike':
        return <Bell className="h-4 w-4 text-blue-500" />
      case 'price_breakout':
        return <TrendingUp className="h-4 w-4 text-purple-500" />
    }
  }

  const unreadCount = alerts.filter((a) => !a.read).length

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground mt-1">{t('description')}</p>
        </div>
        {unreadCount > 0 && (
          <Button onClick={handleMarkAllAsRead} disabled={markingAllRead} variant="outline">
            {markingAllRead ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCheck className="mr-2 h-4 w-4" />
            )}
            {t('markAllAsRead')}
          </Button>
        )}
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as 'all' | 'unread')}>
        <TabsList>
          <TabsTrigger value="all">
            {t('tabs.all')} ({alerts.length})
          </TabsTrigger>
          <TabsTrigger value="unread">
            {t('tabs.unread')} ({unreadCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="space-y-4 mt-6">
          {loading ? (
            <Card>
              <CardContent className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          ) : alerts.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center h-64 text-center">
                <BellOff className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">{t('empty')}</p>
                <p className="text-sm text-muted-foreground mt-2">{t('emptyHint')}</p>
              </CardContent>
            </Card>
          ) : (
            alerts.map((alert) => (
              <Card key={alert.id} className={alert.read ? 'opacity-60' : ''}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="mt-1">{getAlertTypeIcon(alert.alertType)}</div>
                      <div className="flex-1 space-y-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                          {alert.stockName} ({alert.stockCode})
                          {!alert.read && <Badge variant="default">{t('unread')}</Badge>}
                        </CardTitle>
                        <div className="text-sm text-muted-foreground">
                          {t(`alertTypes.${alert.alertType}`)}
                        </div>
                      </div>
                    </div>
                    {!alert.read && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleMarkAsRead(alert.id)}
                        disabled={markingRead === alert.id}
                      >
                        {markingRead === alert.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-sm">
                      <strong>{t('triggerData')}:</strong>{' '}
                      <code className="bg-muted px-2 py-1 rounded">
                        {JSON.stringify(alert.triggerData)}
                      </code>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t('triggerTime')}:{' '}
                      {formatDistanceToNow(new Date(alert.triggerTime), {
                        addSuffix: true,
                        locale: dateLocale,
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
