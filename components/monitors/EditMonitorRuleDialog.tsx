'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { updateMonitorRule } from '@/actions/monitors'
import { toast } from 'sonner'

interface EditMonitorRuleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  rule: any
  onRuleUpdated: () => void
}

export function EditMonitorRuleDialog({ open, onOpenChange, rule, onRuleUpdated }: EditMonitorRuleDialogProps) {
  const t = useTranslations('StockMonitors.edit')
  const tRoot = useTranslations('StockMonitors')

  // 规则配置
  const [ruleName, setRuleName] = useState('')
  const [ruleType, setRuleType] = useState<string>('price_change')
  const [priceChangeThreshold, setPriceChangeThreshold] = useState('5')
  const [volumeMultiplier, setVolumeMultiplier] = useState('2')
  const [volumePeriod, setVolumePeriod] = useState('60')
  const [limitThreshold, setLimitThreshold] = useState('10')
  const [breakoutPrice, setBreakoutPrice] = useState('')
  const [breakoutDirection, setBreakoutDirection] = useState<'up' | 'down'>('up')
  const [updating, setUpdating] = useState(false)

  // 当 rule 改变时初始化表单值
  useEffect(() => {
    if (rule) {
      setRuleName(rule.ruleName || '')
      setRuleType(rule.ruleType)

      const config = rule.config
      if (rule.ruleType === 'price_change') {
        setPriceChangeThreshold(String(config.priceChangeThreshold || 5))
      } else if (rule.ruleType === 'volume_spike') {
        setVolumeMultiplier(String(config.volumeMultiplier || 2))
        setVolumePeriod(String(config.volumePeriod || 60))
      } else if (rule.ruleType === 'limit_up' || rule.ruleType === 'limit_down') {
        setLimitThreshold(String(config.limitThreshold || 10))
      } else if (rule.ruleType === 'price_breakout') {
        setBreakoutPrice(String(config.breakoutPrice || ''))
        setBreakoutDirection(config.breakoutDirection || 'up')
      }
    }
  }, [rule])

  const handleUpdate = async () => {
    // 构建配置
    const config: any = {}

    switch (ruleType) {
      case 'price_change':
        config.priceChangeThreshold = parseFloat(priceChangeThreshold)
        break
      case 'volume_spike':
        config.volumeMultiplier = parseFloat(volumeMultiplier)
        config.volumePeriod = parseInt(volumePeriod)
        break
      case 'limit_up':
      case 'limit_down':
        config.limitThreshold = parseFloat(limitThreshold)
        break
      case 'price_breakout':
        if (!breakoutPrice) {
          toast.error(t('breakoutPriceRequired'))
          return
        }
        config.breakoutPrice = parseFloat(breakoutPrice)
        config.breakoutDirection = breakoutDirection
        break
    }

    setUpdating(true)
    try {
      const result = await updateMonitorRule({
        ruleId: rule.id,
        ruleType: ruleType as any,
        ruleName: ruleName.trim() || undefined,
        config,
      })

      if (result.success) {
        toast.success(t('success'))
        onRuleUpdated()
        onOpenChange(false)
      } else {
        toast.error(t('error'))
      }
    } catch (error) {
      toast.error(t('error'))
    } finally {
      setUpdating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{tRoot('create.ruleNameLabel')}</Label>
            <Input
              placeholder={tRoot('create.ruleNamePlaceholder')}
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">{tRoot('create.ruleNameHint')}</p>
          </div>

          <div className="space-y-2">
            <Label>{tRoot('create.ruleTypeLabel')}</Label>
            <Select value={ruleType} onValueChange={setRuleType}>
              <SelectTrigger>
                <SelectValue placeholder={tRoot('create.ruleTypePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="price_change">{tRoot('ruleTypes.priceChange')}</SelectItem>
                <SelectItem value="volume_spike">{tRoot('ruleTypes.volumeSpike')}</SelectItem>
                <SelectItem value="limit_up">{tRoot('ruleTypes.limitUp')}</SelectItem>
                <SelectItem value="limit_down">{tRoot('ruleTypes.limitDown')}</SelectItem>
                <SelectItem value="price_breakout">{tRoot('ruleTypes.priceBreakout')}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {ruleType === 'price_change' && tRoot('ruleTypesDescription.priceChange')}
              {ruleType === 'volume_spike' && tRoot('ruleTypesDescription.volumeSpike')}
              {ruleType === 'limit_up' && tRoot('ruleTypesDescription.limitUp')}
              {ruleType === 'limit_down' && tRoot('ruleTypesDescription.limitDown')}
              {ruleType === 'price_breakout' && tRoot('ruleTypesDescription.priceBreakout')}
            </p>
          </div>

          {ruleType === 'price_change' && (
            <div className="space-y-2">
              <Label>{tRoot('create.priceChangeThresholdLabel')}</Label>
              <Input
                type="number"
                value={priceChangeThreshold}
                onChange={(e) => setPriceChangeThreshold(e.target.value)}
                placeholder="5"
                min="0"
                step="0.1"
              />
              <p className="text-sm text-muted-foreground">{tRoot('create.priceChangeThresholdHint')}</p>
            </div>
          )}

          {ruleType === 'volume_spike' && (
            <>
              <div className="space-y-2">
                <Label>{tRoot('create.volumeMultiplierLabel')}</Label>
                <Input
                  type="number"
                  value={volumeMultiplier}
                  onChange={(e) => setVolumeMultiplier(e.target.value)}
                  placeholder="2"
                  min="1"
                  step="0.1"
                />
              </div>
              <div className="space-y-2">
                <Label>{tRoot('create.volumePeriodLabel')}</Label>
                <Input
                  type="number"
                  value={volumePeriod}
                  onChange={(e) => setVolumePeriod(e.target.value)}
                  placeholder="60"
                  min="10"
                />
                <p className="text-sm text-muted-foreground">{tRoot('create.volumePeriodHint')}</p>
              </div>
            </>
          )}

          {(ruleType === 'limit_up' || ruleType === 'limit_down') && (
            <div className="space-y-2">
              <Label>{tRoot('create.limitThresholdLabel')}</Label>
              <Input
                type="number"
                value={limitThreshold}
                onChange={(e) => setLimitThreshold(e.target.value)}
                placeholder="10"
                min="0"
                step="0.1"
              />
              <p className="text-sm text-muted-foreground">{tRoot('create.limitThresholdHint')}</p>
            </div>
          )}

          {ruleType === 'price_breakout' && (
            <>
              <div className="space-y-2">
                <Label>{tRoot('create.breakoutPriceLabel')}</Label>
                <Input
                  type="number"
                  value={breakoutPrice}
                  onChange={(e) => setBreakoutPrice(e.target.value)}
                  placeholder="100.00"
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="space-y-2">
                <Label>{tRoot('create.breakoutDirectionLabel')}</Label>
                <Select value={breakoutDirection} onValueChange={(v: any) => setBreakoutDirection(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="up">{tRoot('create.breakoutDirectionUp')}</SelectItem>
                    <SelectItem value="down">{tRoot('create.breakoutDirectionDown')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <div className="flex justify-end pt-4">
            <Button onClick={handleUpdate} disabled={updating}>
              {updating ? t('updating') : t('update')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
