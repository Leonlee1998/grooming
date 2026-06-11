import { notFound } from 'next/navigation'
import { prismaAdmin } from '@repo/db'
import { getOnlineContractHtml } from './actions'
import { SignPageClient } from './SignPageClient'

interface Props {
  params: { storeSlug: string }
}

export const metadata = {
  title: '確認並簽署契約',
}

export default async function SignPage({ params }: Props) {
  const store = await prismaAdmin.store.findUnique({
    where: { slug: params.storeSlug, isActive: true },
    select: { id: true, name: true, address: true, phone: true },
  })
  if (!store) notFound()

  const { html, error } = await getOnlineContractHtml(params.storeSlug)

  return (
    <SignPageClient
      storeSlug={params.storeSlug}
      storeName={store.name}
      contractHtml={html}
      contractError={error}
    />
  )
}
