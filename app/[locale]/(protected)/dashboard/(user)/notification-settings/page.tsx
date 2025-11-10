import { getTranslations } from 'next-intl/server'
import NotificationSettingsClient from './NotificationSettingsClient'

export async function generateMetadata({ params }: { params: { locale: string } }) {
  const t = await getTranslations({ locale: params.locale, namespace: 'NotificationSettings' })
  return {
    title: t('title'),
    description: t('description'),
  }
}

export default function NotificationSettingsPage() {
  return <NotificationSettingsClient />
}
