import { getCustomers } from './actions'

export const dynamic = 'force-dynamic'

const SPECIES_LABELS: Record<string, string> = {
  DOG: '狗',
  CAT: '貓',
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    timeZone: 'Asia/Taipei',
  })
}

export default async function CustomersPage() {
  const rows = await getCustomers()

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">客戶管理</h1>
          <p className="mt-1 text-sm text-slate-500">共 {rows.length} 位客戶</p>
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
                  寵物
                </th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">
                  訂單數
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">
                  最後消費
                </th>
                <th className="px-4 py-3 text-center font-medium text-slate-600">
                  會員
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">
                  加入日期
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-slate-400"
                  >
                    尚無客戶資料
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{row.name}</p>
                      <p className="text-xs text-slate-500">{row.phone}</p>
                      {row.email && (
                        <p className="text-xs text-slate-400">{row.email}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {row.pets.length === 0 ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {row.pets.map((p) => (
                            <span
                              key={p.name}
                              className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs text-amber-800"
                            >
                              {p.name}（{SPECIES_LABELS[p.species] ?? p.species}
                              ）
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {row.orderCount}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {row.lastOrderAt ? (
                        fmtDate(row.lastOrderAt)
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {row.isMember ? (
                        <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-700">
                          會員
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {fmtDate(row.createdAt)}
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
