'use client'

import { updateStockPosition } from '@/actions/stocks'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

interface EditPositionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  watchedStockId: string
  stockName: string
  stockCode: string
  initialCostPrice?: string | null
  initialQuantity?: number | null
  onPositionUpdated: () => void
}

export function EditPositionDialog({
  open,
  onOpenChange,
  watchedStockId,
  stockName,
  stockCode,
  initialCostPrice,
  initialQuantity,
  onPositionUpdated,
}: EditPositionDialogProps) {
  const t = useTranslations('StockPosition')
  const [costPrice, setCostPrice] = useState('')
  const [quantity, setQuantity] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{ costPrice?: string; quantity?: string }>({})

  useEffect(() => {
    if (open) {
      setCostPrice(initialCostPrice || '')
      setQuantity(initialQuantity?.toString() || '')
      setErrors({})
    }
  }, [open, initialCostPrice, initialQuantity])

  const validateForm = (): boolean => {
    const newErrors: { costPrice?: string; quantity?: string } = {}

    // 如果两个字段都为空,允许保存(表示清空持仓信息)
    if (!costPrice && !quantity) {
      setErrors({})
      return true
    }

    // 如果只填了一个字段,报错
    if (!costPrice && quantity) {
      newErrors.costPrice = t('validationCostPrice')
    }
    if (costPrice && !quantity) {
      newErrors.quantity = t('validationQuantity')
    }

    // 验证成本价格式和值
    if (costPrice) {
      const price = parseFloat(costPrice)
      if (isNaN(price) || price <= 0) {
        newErrors.costPrice = t('validationCostPrice')
      }
    }

    // 验证持股数量格式和值
    if (quantity) {
      const qty = parseInt(quantity)
      if (isNaN(qty) || qty <= 0 || !Number.isInteger(parseFloat(quantity))) {
        newErrors.quantity = t('validationQuantity')
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validateForm()) {
      return
    }

    setLoading(true)
    try {
      const result = await updateStockPosition({
        watchedStockId,
        costPrice: costPrice || null,
        quantity: quantity ? parseInt(quantity) : null,
      })

      if (result.success) {
        toast.success(t('updateSuccess'))
        onPositionUpdated()
        onOpenChange(false)
      } else {
        toast.error(t('updateError'), {
          description: result.error || 'Unknown error',
        })
      }
    } catch (error) {
      toast.error(t('updateError'), {
        description: String(error),
      })
    } finally {
      setLoading(false)
    }
  }

  const totalCost = costPrice && quantity
    ? (parseFloat(costPrice) * parseInt(quantity)).toFixed(2)
    : '0.00'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('editPosition')}</DialogTitle>
          <DialogDescription>
            {stockName} ({stockCode})
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* 成本价输入 */}
          <div className="grid gap-2">
            <Label htmlFor="costPrice">
              {t('costPrice')} ({t('yuan')})
            </Label>
            <Input
              id="costPrice"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={costPrice}
              onChange={(e) => {
                setCostPrice(e.target.value)
                setErrors((prev) => ({ ...prev, costPrice: undefined }))
              }}
              className={errors.costPrice ? 'border-red-500' : ''}
            />
            {errors.costPrice && (
              <p className="text-sm text-red-500">{errors.costPrice}</p>
            )}
          </div>

          {/* 持股数量输入 */}
          <div className="grid gap-2">
            <Label htmlFor="quantity">
              {t('quantity')} ({t('shares')})
            </Label>
            <Input
              id="quantity"
              type="number"
              step="1"
              min="0"
              placeholder="0"
              value={quantity}
              onChange={(e) => {
                setQuantity(e.target.value)
                setErrors((prev) => ({ ...prev, quantity: undefined }))
              }}
              className={errors.quantity ? 'border-red-500' : ''}
            />
            {errors.quantity && (
              <p className="text-sm text-red-500">{errors.quantity}</p>
            )}
          </div>

          {/* 总成本显示 */}
          {costPrice && quantity && (
            <div className="grid gap-2">
              <Label>{t('totalCost')}</Label>
              <div className="px-3 py-2 bg-muted rounded-md">
                <span className="text-lg font-semibold">¥{totalCost}</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {t('cancel')}
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
