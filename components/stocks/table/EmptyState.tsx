'use client'

import { Button } from '@/components/ui/button'
import { TrendingUp } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface EmptyStateProps {
  onAddStock?: () => void
}

export function EmptyState({ onAddStock }: EmptyStateProps) {
  const t = useTranslations('MyStocks')

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="rounded-full bg-muted p-6 mb-4">
        <TrendingUp className="h-12 w-12 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{t('table.emptyState.title')}</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-md">
        {t('table.emptyState.description')}
      </p>
      {onAddStock && (
        <Button onClick={onAddStock}>
          {t('table.emptyState.addButton')}
        </Button>
      )}
    </div>
  )
}
