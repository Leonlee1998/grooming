import { getMembers } from './actions'
import { TopUpButton } from './TopUpButton'

export const dynamic = 'force-dynamic'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    timeZone: 'Asia/Taipei',
  })
}

export default async function MembersPage() {
  const rows = await getMembers()

  const totalBalance = rows.reduce((s, r) => s + r.balance, 0)
  const totalPoints = rows.reduce((s, r) => s + r.points, 0)

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">會員管理</h1>
          <p className="mt-1 text-sm text-slate-500">共 {rows.length} 位會員</p>
        </div>
        <div className="flex gap-3">
          <div className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-right">
            <p className="text-xs text-slate-500">總儲值金餘額</p>
            <p className="mt-0.5 text-lg font-bold text-slate-900">
              ${totalBalance.toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-right">
            <p className="text-xs text-slate-500">總點數</p>
            <p className="mt-0.5 text-lg font-bold text-slate-900">
              {totalPoints.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left font-medium text-slate-600">
                  客戶
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">
                  方案
                </th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">
                  點數
                </th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">
                  儲值金（元）
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">
                  加入日期
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">
                  到期日
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-slate-400"
                  >
                    尚無會員資料
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">
                        {row.customerName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {row.customerPhone}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-700">
                        {row.planName}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-900">
                      {row.points.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-700">
                      ${row.balance.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {fmtDate(row.joinedAt)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {row.expiresAt ? (
                        <span
                          className={
                            new Date(row.expiresAt) < new Date()
                              ? 'font-medium text-red-600'
                              : ''
                          }
                        >
                          {fmtDate(row.expiresAt)}
                        </span>
                      ) : (
                        <span className="text-slate-400">無期限</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <TopUpButton
                        memberId={row.id}
                        customerName={row.customerName}
                      />
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
