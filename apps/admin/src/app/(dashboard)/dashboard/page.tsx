import {
  getDashboardStats,
  getTodayAppointments,
  getOvertimeAlerts,
} from './actions'
import { DashboardClient } from './DashboardClient'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const [stats, appointments, overtimeAlerts] = await Promise.all([
    getDashboardStats(),
    getTodayAppointments(),
    getOvertimeAlerts(),
  ])

  return (
    <DashboardClient
      stats={stats}
      appointments={appointments}
      overtimeAlerts={overtimeAlerts}
    />
  )
}
