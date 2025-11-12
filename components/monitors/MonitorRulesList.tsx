'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Trash2, Edit2, Link } from 'lucide-react'
import { updateMonitorRule, deleteMonitorRule, getRuleStocks, getMonitoredStocks } from '@/actions/monitors'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { EditMonitorRuleDialog } from './EditMonitorRuleDialog'
import { RuleStockSelectorDialog } from './RuleStockSelectorDialog'

interface MonitorRulesListProps {
  rules: any[]
  loading: boolean
  onRulesChange: () => void
}

export function MonitorRulesList({ rules, loading, onRulesChange }: MonitorRulesListProps) {
  const t = useTranslations('StockMonitors')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [ruleToDelete, setRuleToDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [ruleToEdit, setRuleToEdit] = useState<any | null>(null)

  // 股票选择相关状态
  const [selectedRuleForStocks, setSelectedRuleForStocks] = useState<string | null>(null)
  const [ruleStockCounts, setRuleStockCounts] = useState<Map<string, number>>(new Map())
  const [monitoredStocks, setMonitoredStocks] = useState<any[]>([])

  // 加载监控股票列表
  useEffect(() => {
    loadMonitoredStocks()
  }, [])

  const loadMonitoredStocks = async () => {
    const result = await getMonitoredStocks()
    if (result.success && result.data && 'stocks' in result.data) {
      setMonitoredStocks((result.data.stocks as any[]) || [])
    }
  }

  // 加载规则的股票数量
  useEffect(() => {
    if (rules.length > 0) {
      loadRuleStockCounts()
    }
  }, [rules])

  const loadRuleStockCounts = async () => {
    const counts = new Map<string, number>()
    await Promise.all(
      rules.map(async (rule) => {
        const result = await getRuleStocks(rule.id)
        if (result.success && result.data && 'associations' in result.data) {
          counts.set(rule.id, (result.data.associations as any[])?.length || 0)
        }
      })
    )
    setRuleStockCounts(counts)
  }

  const getRuleTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      price_change: t('ruleTypes.priceChange'),
      volume_spike: t('ruleTypes.volumeSpike'),
      limit_up: t('ruleTypes.limitUp'),
      limit_down: t('ruleTypes.limitDown'),
      price_breakout: t('ruleTypes.priceBreakout'),
    }
    return labels[type] || type
  }

  const handleToggleEnabled = async (ruleId: string, enabled: boolean) => {
    const result = await updateMonitorRule({ ruleId, enabled })
    if (result.success) {
      toast.success(t('list.toggleSuccess'))
      onRulesChange()
    } else {
      toast.error(t('list.toggleError'))
    }
  }

  const handleEditClick = (rule: any) => {
    setRuleToEdit(rule)
    setEditDialogOpen(true)
  }

  const handleDeleteClick = (ruleId: string) => {
    setRuleToDelete(ruleId)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!ruleToDelete) return

    setDeleting(true)
    try {
      const result = await deleteMonitorRule(ruleToDelete)
      if (result.success) {
        toast.success(t('list.deleteSuccess'))
        onRulesChange()
      } else {
        toast.error(t('list.deleteError'))
      }
    } catch (error) {
      toast.error(t('list.deleteError'))
    } finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
      setRuleToDelete(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  if (rules.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground text-lg">{t('list.empty')}</p>
        <p className="text-sm text-muted-foreground mt-2">{t('list.emptyHint')}</p>
      </div>
    )
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('list.ruleName')}</TableHead>
            <TableHead>{t('list.ruleType')}</TableHead>
            <TableHead>{t('list.config')}</TableHead>
            <TableHead>{t('list.status')}</TableHead>
            <TableHead>{t('list.createdAt')}</TableHead>
            <TableHead className="text-right">{t('list.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rules.map((rule) => (
            <TableRow key={rule.id}>
              <TableCell>
                <div className="font-medium">
                  {rule.ruleName || getRuleTypeLabel(rule.ruleType)}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{getRuleTypeLabel(rule.ruleType)}</Badge>
              </TableCell>
              <TableCell>
                <div className="text-sm">
                  {rule.ruleType === 'price_change' && `±${rule.config.priceChangeThreshold}%`}
                  {rule.ruleType === 'volume_spike' &&
                    `${rule.config.volumeMultiplier}x (${rule.config.volumePeriod}min)`}
                  {rule.ruleType === 'limit_up' && `${rule.config.limitThreshold || 10}%`}
                  {rule.ruleType === 'limit_down' && `${rule.config.limitThreshold || 10}%`}
                  {rule.ruleType === 'price_breakout' &&
                    `¥${rule.config.breakoutPrice} (${rule.config.breakoutDirection})`}
                </div>
              </TableCell>
              <TableCell>
                <Switch
                  checked={rule.enabled}
                  onCheckedChange={(checked) => handleToggleEnabled(rule.id, checked)}
                />
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {new Date(rule.createdAt).toLocaleDateString('zh-CN')}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedRuleForStocks(rule.id)}
                    title={t('list.selectStocks')}
                  >
                    <Link className="h-4 w-4" />
                    <span className="text-xs ml-1">({ruleStockCounts.get(rule.id) || 0})</span>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleEditClick(rule)} title={t('list.edit')}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteClick(rule.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('list.deleteConfirm')}</AlertDialogTitle>
            <AlertDialogDescription>{t('list.deleteDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('list.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} disabled={deleting}>
              {deleting ? t('list.deleting') : t('list.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {ruleToEdit && (
        <EditMonitorRuleDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          rule={ruleToEdit}
          onRuleUpdated={onRulesChange}
        />
      )}

      {selectedRuleForStocks && (
        <RuleStockSelectorDialog
          open={true}
          onOpenChange={(open) => !open && setSelectedRuleForStocks(null)}
          ruleId={selectedRuleForStocks}
          ruleName={rules.find((r) => r.id === selectedRuleForStocks)?.ruleName || ''}
          ruleType={rules.find((r) => r.id === selectedRuleForStocks)?.ruleType || ''}
          availableStocks={monitoredStocks}
          onStocksChanged={() => {
            loadRuleStockCounts()
          }}
        />
      )}
    </>
  )
}
