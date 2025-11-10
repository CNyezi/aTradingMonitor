'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Bell, BellOff, Trash2, Edit } from 'lucide-react'
import { getUserMonitorRules } from '@/actions/monitors'
import { CreateMonitorRuleDialog } from '@/components/monitors/CreateMonitorRuleDialog'
import { MonitorRulesList } from '@/components/monitors/MonitorRulesList'
import { toast } from 'sonner'

export default function StockMonitorsClient() {
  const t = useTranslations('StockMonitors')
  const [rules, setRules] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  const loadRules = async () => {
    setLoading(true)
    try {
      const result = await getUserMonitorRules()
      if (result.success && result.data) {
        setRules(result.data.rules)
      } else {
        toast.error(t('list.loadError'))
      }
    } catch (error) {
      console.error('Failed to load monitor rules:', error)
      toast.error(t('list.loadError'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRules()
  }, [])

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 头部 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground mt-1">{t('description')}</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t('createRule')}
        </Button>
      </div>

      {/* 规则列表 */}
      <Card>
        <CardHeader>
          <CardTitle>{t('list.title')}</CardTitle>
          <CardDescription>{t('list.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <MonitorRulesList rules={rules} loading={loading} onRulesChange={loadRules} />
        </CardContent>
      </Card>

      {/* 创建规则对话框 */}
      <CreateMonitorRuleDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} onRuleCreated={loadRules} />
    </div>
  )
}
