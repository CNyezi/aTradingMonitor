'use client'

import { useState } from 'react'
import { useLocale } from 'next-intl'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PRESET_RULES, type PresetRule } from '@/lib/monitors/preset-rules'
import { Star, Shield, Sparkles, Lightbulb } from 'lucide-react'

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
      case 'core':
        return <Star className="h-4 w-4 text-yellow-500" />
      case 'risk':
        return <Shield className="h-4 w-4 text-red-500" />
      case 'advanced':
        return <Sparkles className="h-4 w-4 text-blue-500" />
      default:
        return null
    }
  }

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <Badge variant="destructive" className="text-xs">高优先级</Badge>
      case 'medium':
        return <Badge variant="secondary" className="text-xs">中优先级</Badge>
      case 'low':
        return <Badge variant="outline" className="text-xs">低优先级</Badge>
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
        core: '核心必备',
        risk: '风险预警',
        advanced: '进阶策略',
      },
      en: {
        all: 'All',
        core: 'Core Essential',
        risk: 'Risk Alert',
        advanced: 'Advanced',
      },
      ja: {
        all: 'すべて',
        core: 'コア必須',
        risk: 'リスク警告',
        advanced: '上級戦略',
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
            {locale === 'zh' ? '盘中实时监控规则' : locale === 'en' ? 'Intraday Real-time Monitoring Rules' : 'リアルタイム監視ルール'}
          </DialogTitle>
          <DialogDescription>
            {locale === 'zh'
              ? '聚焦捕捉盘中关键异动，防止错过重要机会。规则按实战价值分类，高信噪比、低误报率。'
              : locale === 'en'
                ? 'Focus on capturing key intraday movements to avoid missing opportunities. Rules categorized by practical value, high signal-to-noise ratio, low false positives.'
                : '重要な日中の動きを捕捉し、機会を逃さない。実戦価値で分類、高信号対雑音比、低誤報率。'}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="all">{getCategoryName('all')}</TabsTrigger>
            <TabsTrigger value="core">{getCategoryName('core')}</TabsTrigger>
            <TabsTrigger value="risk">{getCategoryName('risk')}</TabsTrigger>
            <TabsTrigger value="advanced">{getCategoryName('advanced')}</TabsTrigger>
          </TabsList>

          <TabsContent value={selectedCategory} className="space-y-4 mt-4">
            {filteredRules.map((rule) => (
              <Card key={rule.id} className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => onSelectRule(rule)}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="mt-1">{getCategoryIcon(rule.category)}</div>
                      <div className="flex-1">
                        <CardTitle className="text-lg flex items-center gap-2 flex-wrap">
                          {getRuleName(rule)}
                          <Badge variant="outline">{getCategoryName(rule.category)}</Badge>
                          {getPriorityBadge(rule.priority)}
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
