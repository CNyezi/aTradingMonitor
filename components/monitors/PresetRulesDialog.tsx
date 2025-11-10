'use client'

import { useState } from 'react'
import { useLocale } from 'next-intl'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PRESET_RULES, type PresetRule } from '@/lib/monitors/preset-rules'
import { TrendingUp, TrendingDown, Activity, Target, Lightbulb } from 'lucide-react'

interface PresetRulesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectRule: (rule: PresetRule) => void
}

export function PresetRulesDialog({ open, onOpenChange, onSelectRule }: PresetRulesDialogProps) {
  const locale = useLocale()
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'limit':
        return <TrendingUp className="h-4 w-4" />
      case 'price_change':
        return <Activity className="h-4 w-4" />
      case 'volume':
        return <Target className="h-4 w-4" />
      case 'breakout':
        return <TrendingDown className="h-4 w-4" />
      default:
        return null
    }
  }

  const getRuleName = (rule: PresetRule) => {
    switch (locale) {
      case 'en':
        return rule.nameEn
      case 'ja':
        return rule.nameJa
      default:
        return rule.name
    }
  }

  const getRuleDescription = (rule: PresetRule) => {
    switch (locale) {
      case 'en':
        return rule.descriptionEn
      case 'ja':
        return rule.descriptionJa
      default:
        return rule.description
    }
  }

  const getRuleUsage = (rule: PresetRule) => {
    switch (locale) {
      case 'en':
        return rule.usageEn
      case 'ja':
        return rule.usageJa
      default:
        return rule.usage
    }
  }

  const getCategoryName = (category: string) => {
    const names = {
      zh: {
        all: '全部',
        limit: '涨跌停监控',
        price_change: '价格波动',
        volume: '成交量异动',
        breakout: '关键突破',
      },
      en: {
        all: 'All',
        limit: 'Limit Up/Down',
        price_change: 'Price Movement',
        volume: 'Volume Spike',
        breakout: 'Breakout',
      },
      ja: {
        all: 'すべて',
        limit: 'ストップ高安',
        price_change: '価格変動',
        volume: '出来高異動',
        breakout: 'ブレイクアウト',
      },
    }

    return names[locale as keyof typeof names]?.[category as keyof typeof names.zh] || category
  }

  const filteredRules = selectedCategory === 'all' ? PRESET_RULES : PRESET_RULES.filter((r) => r.category === selectedCategory)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            {locale === 'zh' ? 'A股典型监控规则' : locale === 'en' ? 'Typical A-Share Monitoring Rules' : 'A株典型監視ルール'}
          </DialogTitle>
          <DialogDescription>
            {locale === 'zh'
              ? '根据A股市场特点精选的常用监控规则，点击选择后可自定义参数'
              : locale === 'en'
                ? 'Curated monitoring rules based on A-share market characteristics, customize after selection'
                : 'A株市場の特性に基づいた厳選監視ルール、選択後にカスタマイズ可能'}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="all">{getCategoryName('all')}</TabsTrigger>
            <TabsTrigger value="limit">{getCategoryName('limit')}</TabsTrigger>
            <TabsTrigger value="price_change">{getCategoryName('price_change')}</TabsTrigger>
            <TabsTrigger value="volume">{getCategoryName('volume')}</TabsTrigger>
            <TabsTrigger value="breakout">{getCategoryName('breakout')}</TabsTrigger>
          </TabsList>

          <TabsContent value={selectedCategory} className="space-y-4 mt-4">
            {filteredRules.map((rule) => (
              <Card key={rule.id} className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => onSelectRule(rule)}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="mt-1">{getCategoryIcon(rule.category)}</div>
                      <div className="flex-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                          {getRuleName(rule)}
                          <Badge variant="outline">{getCategoryName(rule.category)}</Badge>
                        </CardTitle>
                        <CardDescription className="mt-1">{getRuleDescription(rule)}</CardDescription>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      {locale === 'zh' ? '使用' : locale === 'en' ? 'Use' : '使用'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <Badge variant="secondary" className="mt-0.5">
                        {locale === 'zh' ? '使用场景' : locale === 'en' ? 'Usage' : '使用シーン'}
                      </Badge>
                      <p className="text-sm text-muted-foreground flex-1">{getRuleUsage(rule)}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="font-mono">
                        {JSON.stringify(rule.config)}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
