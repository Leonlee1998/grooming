import { getOrders } from './actions'

export const dynamic = 'force-dynamic'

const STATUS_LABELS: Record<string, string> = {
  CONFIRMED: '已確認',
  IN_PROGRESS: '進行中',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
  REFUNDED: '已退款',
}

const STATUS_COLORS: Record<string, string> = {
  CONFIRMED: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-emerald-100 text-emerald-800',
  COMPLETED: 'bg-slate-100 text-slate-700',
  CANCELLED: 'bg-red-100 text-red-700',
  REFUNDED: 'bg-orange-100 text-orange-700',
}

const PAYMENT_LABELS: Record<string, string> = {
  CASH: '現金',
  CARD: '刷卡',
  TRANSFER: '轉帳',
  MEMBER_BALANCE: '儲值金',
}

const SOURCE_LABELS: Record<string, string> = {
  WALK_IN: '現場',
  ONLINE: '線上預約',
  LINE: 'LINE 接單',
  POS_ONSITE: 'POS 現場',
}

const SOURCE_COLORS: Record<string, string> = {
  WALK_IN: 'bg-stone-100 text-stone-600',
  ONLINE: 'bg-blue-100 text-blue-700',
  LINE: 'bg-green-100 text-green-700',
  POS_ONSITE: 'bg-violet-100 text-violet-700',
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('zh-TW', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Taipei',
  })
}

export default async function OrdersPage() {
  const rows = await getOrders(30)

  const totalRevenue = rows
    .filter((r) => r.status === 'COMPLETED')
    .reduce((sum, r) => sum + r.totalAmount, 0)

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">訂單查詢</h1>
          <p className="mt-1 text-sm text-slate-500">
            近 30 天訂單（共 {rows.length} 筆）
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-right">
          <p className="text-xs text-slate-500">近 30 天已完成收入</p>
          <p className="mt-0.5 text-xl font-bold text-slate-900">
            ${totalRevenue.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left font-medium text-slate-600">
                  建立時間
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">
                  客戶 / 寵物
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">
                  服務項目
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">
                  美容師
                </th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">
                  小計
                </th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">
                  折扣
                </th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">
                  總計
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">
                  付款
                </th>
                <th className="px-4 py-3 text-center font-medium text-slate-600">
                  來源
                </th>
                <th className="px-4 py-3 text-center font-medium text-slate-600">
                  狀態
                </th>
                <th className="px-4 py-3 text-center font-medium text-slate-600">
                  契約
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={11}
                    className="px-4 py-12 text-center text-slate-400"
                  >
                    近 30 天內無訂單紀錄
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {fmtDate(row.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">
                        {row.customerName}
                      </p>
                      <p className="text-xs text-slate-500">{row.petName}</p>
                    </td>
                    <td className="max-w-[200px] px-4 py-3 text-slate-600">
                      <span className="line-clamp-2">
                        {row.services || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {row.staffName ?? (
                        <span className="text-slate-400">不指定</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      ${row.subtotalAmount}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {row.discountAmount > 0 ? (
                        <span className="text-red-600">
                          −${row.discountAmount}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                      ${row.totalAmount}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {row.paymentMethod ? (
                        (PAYMENT_LABELS[row.paymentMethod] ?? row.paymentMethod)
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {row.source ? (
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${SOURCE_COLORS[row.source] ?? 'bg-slate-100 text-slate-600'}`}
                        >
                          {SOURCE_LABELS[row.source] ?? row.source}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">現場</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[row.status] ?? 'bg-slate-100 text-slate-600'}`}
                      >
                        {STATUS_LABELS[row.status] ?? row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {row.contractId ? (
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs text-slate-500">有契約</span>
                          {row.hasSupplementary && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                              +補充
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
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
