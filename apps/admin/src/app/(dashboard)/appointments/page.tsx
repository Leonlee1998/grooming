import { getAppointments } from './actions'

export const dynamic = 'force-dynamic'

const STATUS_LABELS: Record<string, string> = {
  PENDING: '待確認',
  CONFIRMED: '已確認',
  IN_PROGRESS: '進行中',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
  NO_SHOW: '未到場',
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-emerald-100 text-emerald-800',
  COMPLETED: 'bg-slate-100 text-slate-700',
  CANCELLED: 'bg-red-100 text-red-700',
  NO_SHOW: 'bg-orange-100 text-orange-700',
}

const SOURCE_LABELS: Record<string, string> = {
  WALK_IN: '現場',
  ONLINE: '線上',
  LINE: 'LINE',
}

const SPECIES_LABELS: Record<string, string> = {
  DOG: '狗',
  CAT: '貓',
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('zh-TW', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Taipei',
  })
}

export default async function AppointmentsPage() {
  const rows = await getAppointments(30)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">預約管理</h1>
          <p className="mt-1 text-sm text-slate-500">
            近 30 天 + 未來預約（共 {rows.length} 筆）
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left font-medium text-slate-600">
                  預約時間
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">
                  客戶
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">
                  寵物
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">
                  美容師
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">
                  來源
                </th>
                <th className="px-4 py-3 text-center font-medium text-slate-600">
                  狀態
                </th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">
                  金額
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-slate-400"
                  >
                    近 30 天內無預約紀錄
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-slate-900">
                      {fmtDateTime(row.scheduledAt)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">
                        {row.customerName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {row.customerPhone}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-900">{row.petName}</p>
                      <p className="text-xs text-slate-500">
                        {SPECIES_LABELS[row.petSpecies] ?? row.petSpecies}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {row.staffName ?? (
                        <span className="text-slate-400">不指定</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
                        {SOURCE_LABELS[row.source] ?? row.source}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[row.status] ?? 'bg-slate-100 text-slate-600'}`}
                      >
                        {STATUS_LABELS[row.status] ?? row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-900">
                      {row.totalAmount != null ? `$${row.totalAmount}` : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
