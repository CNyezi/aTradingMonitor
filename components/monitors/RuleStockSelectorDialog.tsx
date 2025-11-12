'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'
import { getRuleStocks, addRuleStocks, removeStockRule } from '@/actions/monitors'
import { toast } from 'sonner'

interface RuleStockSelectorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ruleId: string
  ruleName: string
  ruleType: string
  availableStocks: any[]
  onStocksChanged: () => void
}

export function RuleStockSelectorDialog({
  open,
  onOpenChange,
  ruleId,
  ruleName,
  ruleType,
  availableStocks,
  onStocksChanged,
}: RuleStockSelectorDialogProps) {
  const t = useTranslations('MyStocks.stockSelector')
  const tMonitors = useTranslations('StockMonitors')
  const [selectedStocks, setSelectedStocks] = useState<Set<string>>(new Set())
  const [originalStocks, setOriginalStocks] = useState<Set<string>>(new Set())
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

  // 加载当前规则关联的股票
  const loadRuleStocks = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getRuleStocks(ruleId)
      if (result.success && result.data && 'associations' in result.data) {
        const stockIds = new Set((result.data.associations as any[]).map((assoc: any) => assoc.watchedStockId))
        setSelectedStocks(stockIds)
        setOriginalStocks(stockIds)
      }
    } catch (error) {
      console.error('Failed to load rule stocks:', error)
    } finally {
      setLoading(false)
    }
  }, [ruleId])

  // 当对话框打开时加载股票
  useEffect(() => {
    if (open && ruleId) {
      loadRuleStocks()
    }
  }, [open, ruleId, loadRuleStocks])

  // 切换股票选择
  const toggleStock = useCallback((stockId: string) => {
    setSelectedStocks((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(stockId)) {
        newSet.delete(stockId)
      } else {
        newSet.add(stockId)
      }
      return newSet
    })
  }, [])

  // 保存更改
  const handleSave = async () => {
    setSaving(true)
    try {
      // 找出需要添加和删除的股票
      const toAdd = Array.from(selectedStocks).filter((id) => !originalStocks.has(id))
      const toRemove = Array.from(originalStocks).filter((id) => !selectedStocks.has(id))

      // 批量添加股票
      if (toAdd.length > 0) {
        const result = await addRuleStocks({ ruleId, watchedStockIds: toAdd })
        if (!result.success) {
          throw new Error(result.error || 'Failed to add stocks')
        }
      }

      // 删除股票（逐个删除）
      for (const watchedStockId of toRemove) {
        const result = await removeStockRule({ watchedStockId, ruleId })
        if (!result.success) {
          throw new Error(result.error || 'Failed to remove stock')
        }
      }

      toast.success(t('saveSuccess') || '保存成功')
      onStocksChanged()
      onOpenChange(false)
    } catch (error) {
      console.error('Failed to save stocks:', error)
      toast.error(t('saveError') || '保存失败')
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
            {t('description')} - {ruleName} ({getRuleTypeLabel(ruleType)})
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : availableStocks.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">{t('noStocks')}</p>
          </div>
        ) : (
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-2">
              {availableStocks.map((stock) => (
                <div
                  key={stock.id}
                  className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent cursor-pointer transition-colors"
                  onClick={() => toggleStock(stock.id)}
                >
                  <Checkbox
                    checked={selectedStocks.has(stock.id)}
                    onCheckedChange={() => toggleStock(stock.id)}
                    className="mt-1"
                  />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {stock.stockName}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {stock.stockCode}
                      </span>
                      {stock.monitored && (
                        <Badge variant="default" className="text-xs">
                          监控中
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      添加于 {new Date(stock.addedAt).toLocaleString('zh-CN')}
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
                {t('saving') || '保存中...'}
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
