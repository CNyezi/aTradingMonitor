import { getSession } from '@/lib/auth/server'
import { constructMetadata } from '@/lib/metadata'
import { Metadata } from 'next'
import { Locale } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'
import MyStocksClient from './MyStocksClient'

type Params = Promise<{ locale: string }>

type MetadataProps = {
  params: Params
}

export async function generateMetadata({ params }: MetadataProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({
    locale,
    namespace: 'MyStocks',
  })

  return constructMetadata({
    page: 'MyStocks',
    title: t('title'),
    description: t('description'),
    locale: locale as Locale,
    path: `/dashboard/my-stocks`,
  })
}

export default async function MyStocksPage() {
  const session = await getSession()
  if (!session) {
    redirect('/login')
  }

  return <MyStocksClient />
}
