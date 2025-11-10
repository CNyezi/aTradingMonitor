'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createMonitorRule } from '@/actions/monitors'
import { toast } from 'sonner'
import { PresetRulesDialog } from './PresetRulesDialog'
import type { PresetRule } from '@/lib/monitors/preset-rules'
import { Lightbulb } from 'lucide-react'

interface CreateMonitorRuleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onRuleCreated: () => void
}

export function CreateMonitorRuleDialog({ open, onOpenChange, onRuleCreated }: CreateMonitorRuleDialogProps) {
  const t = useTranslations('StockMonitors.create')
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
  const [creating, setCreating] = useState(false)
  const [presetDialogOpen, setPresetDialogOpen] = useState(false)

  const handleSelectPreset = (preset: PresetRule) => {
    // 填充预设规则的配置
    setRuleName(preset.name)
    setRuleType(preset.ruleType)

    // 根据规则类型填充配置
    const config = preset.config
    if (preset.ruleType === 'price_change') {
      setPriceChangeThreshold(String(config.priceChangeThreshold))
    } else if (preset.ruleType === 'volume_spike') {
      setVolumeMultiplier(String(config.volumeMultiplier))
      setVolumePeriod(String(config.volumePeriod))
    } else if (preset.ruleType === 'limit_up' || preset.ruleType === 'limit_down') {
      setLimitThreshold(String(config.limitThreshold))
    } else if (preset.ruleType === 'price_breakout') {
      setBreakoutPrice(String(config.breakoutPrice))
      setBreakoutDirection(config.breakoutDirection)
    }

    setPresetDialogOpen(false)
    toast.success(t('presetApplied'))
  }

  const handleCreate = async () => {
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

    setCreating(true)
    try {
      const result = await createMonitorRule({
        ruleType: ruleType as any,
        ruleName: ruleName.trim() || undefined,
        config,
        enabled: true,
      })

      if (result.success) {
        toast.success(t('success'))
        onRuleCreated()
        handleClose()
      } else {
        toast.error(t('error'))
      }
    } catch (error) {
      toast.error(t('error'))
    } finally {
      setCreating(false)
    }
  }

  const handleClose = () => {
    onOpenChange(false)
    setRuleName('')
    setRuleType('price_change')
    setPriceChangeThreshold('5')
    setVolumeMultiplier('2')
    setVolumePeriod('60')
    setLimitThreshold('10')
    setBreakoutPrice('')
    setBreakoutDirection('up')
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Button variant="outline" className="w-full" onClick={() => setPresetDialogOpen(true)}>
            <Lightbulb className="mr-2 h-4 w-4 text-yellow-500" />
            {t('selectPreset')}
          </Button>

          <div className="space-y-2">
            <Label>{t('ruleNameLabel')}</Label>
            <Input
              placeholder={t('ruleNamePlaceholder')}
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">{t('ruleNameHint')}</p>
          </div>

          <div className="space-y-2">
            <Label>{t('ruleTypeLabel')}</Label>
            <Select value={ruleType} onValueChange={setRuleType}>
              <SelectTrigger>
                <SelectValue placeholder={t('ruleTypePlaceholder')} />
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
              <Label>{t('priceChangeThresholdLabel')}</Label>
              <Input
                type="number"
                value={priceChangeThreshold}
                onChange={(e) => setPriceChangeThreshold(e.target.value)}
                placeholder="5"
                min="0"
                step="0.1"
              />
              <p className="text-sm text-muted-foreground">{t('priceChangeThresholdHint')}</p>
            </div>
          )}

          {ruleType === 'volume_spike' && (
            <>
              <div className="space-y-2">
                <Label>{t('volumeMultiplierLabel')}</Label>
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
                <Label>{t('volumePeriodLabel')}</Label>
                <Input
                  type="number"
                  value={volumePeriod}
                  onChange={(e) => setVolumePeriod(e.target.value)}
                  placeholder="60"
                  min="10"
                />
                <p className="text-sm text-muted-foreground">{t('volumePeriodHint')}</p>
              </div>
            </>
          )}

          {(ruleType === 'limit_up' || ruleType === 'limit_down') && (
            <div className="space-y-2">
              <Label>{t('limitThresholdLabel')}</Label>
              <Input
                type="number"
                value={limitThreshold}
                onChange={(e) => setLimitThreshold(e.target.value)}
                placeholder="10"
                min="0"
                step="0.1"
              />
              <p className="text-sm text-muted-foreground">{t('limitThresholdHint')}</p>
            </div>
          )}

          {ruleType === 'price_breakout' && (
            <>
              <div className="space-y-2">
                <Label>{t('breakoutPriceLabel')}</Label>
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
                <Label>{t('breakoutDirectionLabel')}</Label>
                <Select value={breakoutDirection} onValueChange={(v: any) => setBreakoutDirection(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="up">{t('breakoutDirectionUp')}</SelectItem>
                    <SelectItem value="down">{t('breakoutDirectionDown')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <div className="flex justify-end pt-4">
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? t('creating') : t('create')}
            </Button>
          </div>
        </div>
      </DialogContent>

      <PresetRulesDialog open={presetDialogOpen} onOpenChange={setPresetDialogOpen} onSelectRule={handleSelectPreset} />
    </Dialog>
  )
}
