import {
  getRevenueReport,
  getServiceStats,
  getCustomerStats,
  getStaffPerformance,
  getBookingSourceStats,
  getCategoryRevenue,
} from './actions'
import { ReportsClient } from '@/components/reports/ReportsClient'

export const dynamic = 'force-dynamic'

function defaultRange() {
  const now = new Date()
  const end = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
  }).format(now)
  const start30 = new Date(now.getTime() - 29 * 86_400_000)
  const start = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
  }).format(start30)
  return { start, end }
}

export default async function ReportsPage() {
  const { start, end } = defaultRange()

  const [revenue, services, customers, staff, bookingSources, categoryRevenue] =
    await Promise.all([
      getRevenueReport(start, end, 'day'),
      getServiceStats(start, end),
      getCustomerStats(start, end),
      getStaffPerformance(start, end),
      getBookingSourceStats(start, end),
      getCategoryRevenue(start, end),
    ])

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-stone-800 mb-6">營收報表</h1>
      <ReportsClient
        initialRevenue={revenue}
        initialServices={services}
        initialCustomers={customers}
        initialStaff={staff}
        initialBookingSources={bookingSources}
        initialCategoryRevenue={categoryRevenue}
        defaultStartDate={start}
        defaultEndDate={end}
      />
    </div>
  )
}
