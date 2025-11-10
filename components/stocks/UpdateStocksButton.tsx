'use client'

import { fetchAllStocks } from '@/actions/stocks'
import { Button } from '@/components/ui/button'
import { Loader2, RefreshCw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'

interface UpdateStocksButtonProps {
  onSuccess?: () => void
}

export function UpdateStocksButton({ onSuccess }: UpdateStocksButtonProps) {
  const t = useTranslations('MyStocks')
  const [updating, setUpdating] = useState(false)

  const handleUpdate = async () => {
    setUpdating(true)
    try {
      const result = await fetchAllStocks()
      if (result.success && result.data) {
        toast.success(t('update.success'), {
          description: t('update.successDescription', {
            total: result.data.totalCount,
            new: result.data.newCount,
            updated: result.data.updatedCount,
          }),
        })
        onSuccess?.()
      } else {
        toast.error(t('update.error'), {
          description: result.error || 'Unknown error',
        })
      }
    } catch (error) {
      toast.error(t('update.error'), {
        description: String(error),
      })
    } finally {
      setUpdating(false)
    }
  }

  return (
    <Button onClick={handleUpdate} disabled={updating} variant="outline">
      {updating ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <RefreshCw className="mr-2 h-4 w-4" />
      )}
      {t('update.button')}
    </Button>
  )
}
