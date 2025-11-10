import { getTranslations } from 'next-intl/server'
import StockAlertsClient from './StockAlertsClient'

export async function generateMetadata({ params }: { params: { locale: string } }) {
  const t = await getTranslations({ locale: params.locale, namespace: 'StockAlerts' })
  return {
    title: t('title'),
    description: t('description'),
  }
}

export default function StockAlertsPage() {
  return <StockAlertsClient />
}
