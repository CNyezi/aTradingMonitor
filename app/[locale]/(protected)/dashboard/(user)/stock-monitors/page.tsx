import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import StockMonitorsClient from './StockMonitorsClient'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('StockMonitors')

  return {
    title: t('title'),
    description: t('description'),
  }
}

export default function StockMonitorsPage() {
  return <StockMonitorsClient />
}
