import { notFound } from 'next/navigation'
import { getStoreBySlug, getServicesForCustomer } from './actions'
import { BookingFlow } from './BookingFlow'

interface Props {
  params: { storeSlug: string }
}

export async function generateMetadata({ params }: Props) {
  const store = await getStoreBySlug(params.storeSlug)
  if (!store) return { title: '找不到店家' }
  return {
    title: `${store.name} — 線上預約`,
    description: `${store.name} 線上預約，選擇服務、時段，即可完成預約申請。`,
  }
}

export default async function BookingPage({ params }: Props) {
  const store = await getStoreBySlug(params.storeSlug)
  if (!store) notFound()

  const services = await getServicesForCustomer(store.id)

  return (
    <BookingFlow
      store={store}
      services={services}
      storeSlug={params.storeSlug}
    />
  )
}
