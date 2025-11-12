'use client'

import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

interface TableToolbarProps {
  globalFilter: string
  setGlobalFilter: (value: string) => void
  stockCount: number
}

export function TableToolbar({ globalFilter, setGlobalFilter, stockCount }: TableToolbarProps) {
  const t = useTranslations('MyStocks')
  const [searchValue, setSearchValue] = useState(globalFilter)

  // 防抖搜索
  useEffect(() => {
    const timeout = setTimeout(() => {
      setGlobalFilter(searchValue)
    }, 300)

    return () => clearTimeout(timeout)
  }, [searchValue, setGlobalFilter])

  // 同步外部变化
  useEffect(() => {
    setSearchValue(globalFilter)
  }, [globalFilter])

  return (
    <div className="flex items-center justify-between gap-4 py-4">
      {/* 搜索框 */}
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t('table.searchPlaceholder')}
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* 股票数量统计 */}
      <div className="text-sm text-muted-foreground">
        {t('table.totalStocks', { count: stockCount })}
      </div>
    </div>
  )
}
