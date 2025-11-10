'use client'

import { searchStocks, watchStock } from '@/actions/stocks'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { userStockGroups as groupsSchema, stocks as stocksSchema } from '@/lib/db/schema'
import { Loader2, Plus, Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'

interface StockSearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  groups: Array<typeof groupsSchema.$inferSelect>
  onStockAdded: () => void
}

export function StockSearchDialog({
  open,
  onOpenChange,
  groups,
  onStockAdded,
}: StockSearchDialogProps) {
  const t = useTranslations('MyStocks')
  const [keyword, setKeyword] = useState('')
  const [searchResults, setSearchResults] = useState<Array<typeof stocksSchema.$inferSelect>>([])
  const [searching, setSearching] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)

  const handleSearch = async () => {
    if (!keyword.trim()) {
      return
    }

    setSearching(true)
    try {
      const result = await searchStocks({ keyword: keyword.trim(), limit: 20 })
      if (result.success && result.data) {
        setSearchResults(result.data.stocks)
        if (result.data.stocks.length === 0) {
          toast.info(t('search.noResults'))
        }
      } else {
        toast.error(t('search.error'), {
          description: result.error || 'Unknown error',
        })
      }
    } catch (error) {
      toast.error(t('search.error'), {
        description: String(error),
      })
    } finally {
      setSearching(false)
    }
  }

  const handleAddStock = async (stockId: string) => {
    setAdding(stockId)
    try {
      const result = await watchStock({
        stockId,
        groupId: selectedGroupId,
      })

      if (result.success) {
        toast.success(t('search.addSuccess'))
        onStockAdded()
        setKeyword('')
        setSearchResults([])
        onOpenChange(false)
      } else {
        toast.error(t('search.addError'), {
          description: result.error || 'Unknown error',
        })
      }
    } catch (error) {
      toast.error(t('search.addError'), {
        description: String(error),
      })
    } finally {
      setAdding(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('search.title')}</DialogTitle>
          <DialogDescription>{t('search.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-y-auto">
          {/* 搜索栏 */}
          <div className="flex gap-2">
            <Input
              placeholder={t('searchPlaceholder')}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={searching || !keyword.trim()}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>

          {/* 分组选择 */}
          {groups.length > 0 && (
            <Select value={selectedGroupId || 'none'} onValueChange={(v) => setSelectedGroupId(v === 'none' ? null : v)}>
              <SelectTrigger>
                <SelectValue placeholder={t('search.selectGroup')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('search.noGroup')}</SelectItem>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* 搜索结果 */}
          {searchResults.length > 0 && (
            <div className="space-y-2">
              {searchResults.map((stock) => (
                <div
                  key={stock.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent"
                >
                  <div>
                    <div className="font-medium">
                      {stock.name} ({stock.symbol})
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {stock.tsCode} • {stock.industry || '-'} • {stock.area || '-'}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleAddStock(stock.id)}
                    disabled={adding === stock.id}
                  >
                    {adding === stock.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-1" />
                        {t('search.add')}
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
