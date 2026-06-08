import { getServices } from './actions'
import { ServicesClient } from '@/components/services/ServicesClient'

export const dynamic = 'force-dynamic'

export default async function ServicesPage() {
  const services = await getServices()

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">服務項目管理</h1>
        <p className="mt-1 text-sm text-slate-500">
          拖曳列調整在 POS 的顯示順序
        </p>
      </div>
      <ServicesClient initialServices={services} />
    </div>
  )
}
