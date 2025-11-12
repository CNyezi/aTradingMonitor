'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Loader2 } from 'lucide-react'
import { getStockRules, addStockRule, removeStockRule, toggleStockRuleEnabled } from '@/actions/monitors'
import { toast } from 'sonner'

interface StockRuleAssociation {
  ruleId: string
  enabled: boolean
}

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
  const [ruleAssociations, setRuleAssociations] = useState<Map<string, StockRuleAssociation>>(new Map())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

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
        const associations = result.data.associations as any[]
        const ruleIds = new Set(associations.map((assoc: any) => assoc.ruleId))
        const assocMap = new Map(
          associations.map((assoc: any) => [
            assoc.ruleId,
            { ruleId: assoc.ruleId, enabled: assoc.enabled }
          ])
        )
        setSelectedRules(ruleIds)
        setOriginalRules(ruleIds)
        setRuleAssociations(assocMap)
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

  // 全选
  const handleSelectAll = useCallback(() => {
    const enabledRuleIds = availableRules
      .filter((rule) => rule.enabled)
      .map((rule) => rule.id)
    setSelectedRules(new Set(enabledRuleIds))
  }, [availableRules])

  // 取消全选
  const handleDeselectAll = useCallback(() => {
    setSelectedRules(new Set())
  }, [])

  // 切换单个规则的启用状态（仅对已关联的规则）
  const handleToggleRuleEnabled = async (ruleId: string, enabled: boolean) => {
    setIsUpdating(true)
    try {
      const result = await toggleStockRuleEnabled({
        watchedStockId,
        ruleId,
        enabled,
      })

      if (result.success) {
        // 更新本地状态
        setRuleAssociations((prev) => {
          const newMap = new Map(prev)
          const assoc = newMap.get(ruleId)
          if (assoc) {
            newMap.set(ruleId, { ...assoc, enabled })
          }
          return newMap
        })
        toast.success(enabled ? t('enableSuccess') : t('disableSuccess'))
        onRulesChanged()
      } else {
        toast.error(t('toggleError'))
      }
    } catch (error) {
      console.error('Failed to toggle rule enabled:', error)
      toast.error(t('toggleError'))
    } finally {
      setIsUpdating(false)
    }
  }

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
      <DialogContent className="max-w-2xl">
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
          <>
            {/* 工具栏 */}
            <div className="flex items-center gap-2 py-2 border-b">
              <Button variant="outline" size="sm" onClick={handleSelectAll}>
                {t('selectAll')}
              </Button>
              <Button variant="outline" size="sm" onClick={handleDeselectAll}>
                {t('deselectAll')}
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <span className="text-sm text-muted-foreground">
                {t('selected')}: {selectedRules.size} {t('items')}
              </span>
            </div>

            {/* 规则列表 - 使用固定高度 */}
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-2 py-4">
                {availableRules.map((rule) => {
                  const isSelected = selectedRules.has(rule.id)
                  const association = ruleAssociations.get(rule.id)
                  const isAssociated = originalRules.has(rule.id)

                  return (
                    <div
                      key={rule.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                        rule.enabled
                          ? 'hover:bg-accent cursor-pointer'
                          : 'opacity-50 bg-muted'
                      }`}
                    >
                      {/* Checkbox */}
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => rule.enabled && toggleRule(rule.id)}
                        disabled={!rule.enabled}
                        className="mt-1"
                      />

                      {/* 规则信息 */}
                      <div className="flex-1 space-y-1" onClick={() => rule.enabled && toggleRule(rule.id)}>
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
                          {isAssociated && association && (
                            <Badge variant={association.enabled ? "default" : "secondary"} className="text-xs">
                              {association.enabled ? '已启用' : '已禁用'}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          创建于 {new Date(rule.createdAt).toLocaleString('zh-CN')}
                        </p>
                      </div>

                      {/* Switch 开关 - 只对已关联的规则显示 */}
                      {isAssociated && association && (
                        <Switch
                          checked={association.enabled}
                          onCheckedChange={(enabled) => handleToggleRuleEnabled(rule.id, enabled)}
                          disabled={isUpdating}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          </>
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
