'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'
import { getStockRules, addStockRule, removeStockRule } from '@/actions/monitors'
import { toast } from 'sonner'

interface StockRuleSelectorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  watchedStockId: string
  stockName: string
  stockCode: string
  availableRules: any[]
  onRulesChanged: () => void
}

export function StockRuleSelectorDialog({
  open,
  onOpenChange,
  watchedStockId,
  stockName,
  stockCode,
  availableRules,
  onRulesChanged,
}: StockRuleSelectorDialogProps) {
  const t = useTranslations('MyStocks.ruleSelector')
  const tMonitors = useTranslations('StockMonitors')
  const [selectedRules, setSelectedRules] = useState<Set<string>>(new Set())
  const [originalRules, setOriginalRules] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // 获取规则类型标签
  const getRuleTypeLabel = useCallback((type: string) => {
    const labels: Record<string, string> = {
      price_change: tMonitors('ruleTypes.priceChange'),
      volume_spike: tMonitors('ruleTypes.volumeSpike'),
      limit_up: tMonitors('ruleTypes.limitUp'),
      limit_down: tMonitors('ruleTypes.limitDown'),
      price_breakout: tMonitors('ruleTypes.priceBreakout'),
    }
    return labels[type] || type
  }, [tMonitors])

  // 获取配置摘要
  const getConfigSummary = useCallback((rule: any) => {
    switch (rule.ruleType) {
      case 'price_change':
        return `±${rule.config.priceChangeThreshold}%`
      case 'volume_spike':
        return `${rule.config.volumeMultiplier}x ${rule.config.volumePeriod}min`
      case 'limit_up':
        return `${rule.config.limitThreshold || 10}%`
      case 'limit_down':
        return `${rule.config.limitThreshold || 10}%`
      case 'price_breakout':
        return `¥${rule.config.breakoutPrice} ${rule.config.breakoutDirection === 'up' ? '↑' : '↓'}`
      default:
        return ''
    }
  }, [])

  // 加载当前股票关联的规则
  const loadStockRules = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getStockRules(watchedStockId)
      if (result.success && result.data && 'associations' in result.data) {
        const ruleIds = new Set((result.data.associations as any[]).map((assoc: any) => assoc.ruleId))
        setSelectedRules(ruleIds)
        setOriginalRules(ruleIds)
      }
    } catch (error) {
      console.error('Failed to load stock rules:', error)
    } finally {
      setLoading(false)
    }
  }, [watchedStockId])

  // 当对话框打开时加载规则
  useEffect(() => {
    if (open && watchedStockId) {
      loadStockRules()
    }
  }, [open, watchedStockId, loadStockRules])

  // 切换规则选择
  const toggleRule = useCallback((ruleId: string) => {
    setSelectedRules((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(ruleId)) {
        newSet.delete(ruleId)
      } else {
        newSet.add(ruleId)
      }
      return newSet
    })
  }, [])

  // 保存更改
  const handleSave = async () => {
    setSaving(true)
    try {
      // 找出需要添加和删除的规则
      const toAdd = Array.from(selectedRules).filter((id) => !originalRules.has(id))
      const toRemove = Array.from(originalRules).filter((id) => !selectedRules.has(id))

      // 执行添加操作
      for (const ruleId of toAdd) {
        const result = await addStockRule({ watchedStockId, ruleId })
        if (!result.success) {
          throw new Error(result.error || 'Failed to add rule')
        }
      }

      // 执行删除操作
      for (const ruleId of toRemove) {
        const result = await removeStockRule({ watchedStockId, ruleId })
        if (!result.success) {
          throw new Error(result.error || 'Failed to remove rule')
        }
      }

      toast.success(t('saveSuccess'))
      onRulesChanged()
      onOpenChange(false)
    } catch (error) {
      console.error('Failed to save rules:', error)
      toast.error(t('saveError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>
            {t('description', { stock: `${stockName} (${stockCode})` })}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : availableRules.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">{t('noRules')}</p>
          </div>
        ) : (
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-2">
              {availableRules.map((rule) => (
                <div
                  key={rule.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                    rule.enabled
                      ? 'hover:bg-accent cursor-pointer'
                      : 'opacity-50 bg-muted'
                  }`}
                  onClick={() => rule.enabled && toggleRule(rule.id)}
                >
                  <Checkbox
                    checked={selectedRules.has(rule.id)}
                    onCheckedChange={() => toggleRule(rule.id)}
                    disabled={!rule.enabled}
                    className="mt-1"
                  />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {rule.ruleName || getRuleTypeLabel(rule.ruleType)}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {getRuleTypeLabel(rule.ruleType)}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {getConfigSummary(rule)}
                      </Badge>
                      {!rule.enabled && (
                        <Badge variant="destructive" className="text-xs">
                          已禁用
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      创建于 {new Date(rule.createdAt).toLocaleString('zh-CN')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('saving')}
              </>
            ) : (
              t('save')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
