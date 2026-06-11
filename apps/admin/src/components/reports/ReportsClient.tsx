'use client'

import { useState, useTransition } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  getRevenueReport,
  getServiceStats,
  getCustomerStats,
  getStaffPerformance,
  getBookingSourceStats,
  getCategoryRevenue,
  exportOrdersCsv,
  type RevenueReport,
  type ServiceStat,
  type CustomerStat,
  type StaffPerf,
  type BookingSourceStat,
  type CategoryRevenueStat,
} from '@/app/(dashboard)/reports/actions'

// ─── Palette ──────────────────────────────────────────────────────────────────

const BROWN = '#78573A'
const WARM_COLORS = [
  '#78573A',
  '#A0845C',
  '#C4A882',
  '#E8C9A0',
  '#F0DCC0',
  '#D4956A',
  '#B06C3E',
  '#8B4513',
  '#6B3410',
  '#4A2410',
]
const PIE_NEW = '#5B8FF9'
const PIE_RETURN = '#5AD8A6'
const PIE_MEMBER = '#F6BD16'
const PIE_NONMEMBER = '#E8684A'

const SOURCE_LABELS: Record<string, string> = {
  WALK_IN: '現場',
  ONLINE: '線上預約',
  LINE: 'LINE 接單',
  POS_ONSITE: 'POS 現場',
}
const SOURCE_COLORS_HEX: Record<string, string> = {
  WALK_IN: '#78716c',
  ONLINE: '#3b82f6',
  LINE: '#22c55e',
  POS_ONSITE: '#8b5cf6',
}

const CATEGORY_LABELS: Record<string, string> = {
  BATH: '洗澡',
  HAIRCUT: '剪毛',
  NAIL: '修甲',
  SPA: 'SPA',
  OTHER: '其他',
}
const CATEGORY_COLORS = ['#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#78716c']

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ntd = (n: number) => `$${n.toLocaleString('zh-TW')}`

function KpiCard({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5">
      <p className="text-xs text-stone-500 font-medium tracking-wide uppercase mb-1">
        {label}
      </p>
      <p className="text-2xl font-bold text-stone-800">{value}</p>
      {sub && <p className="text-xs text-stone-400 mt-1">{sub}</p>}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-base font-semibold text-stone-700 mb-4 flex items-center gap-2">
      {children}
    </h2>
  )
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function RevenueTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number; name: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-stone-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium text-stone-700 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-stone-600">
          {p.name}：
          {typeof p.value === 'number' && p.name === '訂單數'
            ? p.value
            : ntd(p.value)}
        </p>
      ))}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

type Props = {
  initialRevenue: RevenueReport
  initialServices: ServiceStat[]
  initialCustomers: CustomerStat
  initialStaff: StaffPerf[]
  initialBookingSources: BookingSourceStat[]
  initialCategoryRevenue: CategoryRevenueStat[]
  defaultStartDate: string
  defaultEndDate: string
}

export function ReportsClient({
  initialRevenue,
  initialServices,
  initialCustomers,
  initialStaff,
  initialBookingSources,
  initialCategoryRevenue,
  defaultStartDate,
  defaultEndDate,
}: Props) {
  const [startDate, setStartDate] = useState(defaultStartDate)
  const [endDate, setEndDate] = useState(defaultEndDate)
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day')
  const [revenue, setRevenue] = useState(initialRevenue)
  const [services, setServices] = useState(initialServices)
  const [customers, setCustomers] = useState(initialCustomers)
  const [staff, setStaff] = useState(initialStaff)
  const [bookingSources, setBookingSources] = useState(initialBookingSources)
  const [categoryRevenue, setCategoryRevenue] = useState(initialCategoryRevenue)
  const [isPending, startTransition] = useTransition()
  const [isExporting, setIsExporting] = useState(false)

  const fetchAll = (sd: string, ed: string, gb: 'day' | 'week' | 'month') => {
    startTransition(async () => {
      const [r, s, c, p, bs, cr] = await Promise.all([
        getRevenueReport(sd, ed, gb),
        getServiceStats(sd, ed),
        getCustomerStats(sd, ed),
        getStaffPerformance(sd, ed),
        getBookingSourceStats(sd, ed),
        getCategoryRevenue(sd, ed),
      ])
      setRevenue(r)
      setServices(s)
      setCustomers(c)
      setStaff(p)
      setBookingSources(bs)
      setCategoryRevenue(cr)
    })
  }

  const handleDateChange = (sd: string, ed: string) => {
    setStartDate(sd)
    setEndDate(ed)
    fetchAll(sd, ed, groupBy)
  }

  const handleGroupByChange = (gb: 'day' | 'week' | 'month') => {
    setGroupBy(gb)
    fetchAll(startDate, endDate, gb)
  }

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const csv = await exportOrdersCsv(startDate, endDate)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `orders_${startDate}_${endDate}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setIsExporting(false)
    }
  }

  // ── Pie data ──────────────────────────────────────────────────────────────
  const customerTypePie = [
    { name: '新客戶', value: customers.newCustomers },
    { name: '回頭客', value: customers.returningCustomers },
  ]
  const memberPie = [
    { name: '會員', value: customers.memberOrders },
    { name: '非會員', value: customers.nonMemberOrders },
  ]

  const top5Services = services.slice(0, 5)

  return (
    <div
      className={`space-y-8 transition-opacity duration-150 ${isPending ? 'opacity-50 pointer-events-none' : ''}`}
    >
      {/* ── 日期控制列 ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-3 bg-white border border-stone-200 rounded-xl p-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-stone-600 font-medium">期間</label>
          <input
            type="date"
            value={startDate}
            max={endDate}
            onChange={(e) => handleDateChange(e.target.value, endDate)}
            className="border border-stone-300 rounded-lg px-3 py-1.5 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <span className="text-stone-400">至</span>
          <input
            type="date"
            value={endDate}
            min={startDate}
            onChange={(e) => handleDateChange(startDate, e.target.value)}
            className="border border-stone-300 rounded-lg px-3 py-1.5 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex rounded-lg border border-stone-200 overflow-hidden text-sm">
          {(['day', 'week', 'month'] as const).map((gb) => (
            <button
              key={gb}
              onClick={() => handleGroupByChange(gb)}
              className={`px-3 py-1.5 ${groupBy === gb ? 'bg-stone-800 text-white' : 'bg-white text-stone-600 hover:bg-stone-50'}`}
            >
              {gb === 'day' ? '日' : gb === 'week' ? '週' : '月'}
            </button>
          ))}
        </div>

        <button
          onClick={handleExport}
          disabled={isExporting}
          className="ml-auto flex items-center gap-1.5 bg-stone-800 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-stone-700 disabled:opacity-50"
        >
          {isExporting ? '匯出中…' : '↓ 匯出 CSV'}
        </button>
      </div>

      {/* ── KPI 總覽 ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard label="總營收" value={ntd(revenue.totalRevenue)} />
        <KpiCard label="完成訂單" value={`${revenue.totalOrders} 筆`} />
        <KpiCard label="客單價" value={ntd(revenue.avgOrderValue)} />
        <KpiCard label="新客數" value={`${revenue.newCustomers} 人`} />
      </div>

      {/* ── 營收趨勢折線圖 ─────────────────────────────────────────────────── */}
      <div className="bg-white border border-stone-200 rounded-xl p-5">
        <SectionTitle>
          每{groupBy === 'day' ? '日' : groupBy === 'week' ? '週' : '月'}
          營收趨勢
        </SectionTitle>
        {revenue.points.length === 0 ? (
          <p className="text-stone-400 text-sm text-center py-12">
            此期間無資料
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart
              data={revenue.points}
              margin={{ top: 4, right: 16, bottom: 4, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0ece8" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#78716c' }}
                tickFormatter={(v: string) => v.slice(5)}
              />
              <YAxis
                yAxisId="revenue"
                tick={{ fontSize: 11, fill: '#78716c' }}
                tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
              />
              <YAxis
                yAxisId="count"
                orientation="right"
                tick={{ fontSize: 11, fill: '#78716c' }}
              />
              <Tooltip content={<RevenueTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                yAxisId="revenue"
                type="monotone"
                dataKey="revenue"
                name="營收（元）"
                stroke={BROWN}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                yAxisId="count"
                type="monotone"
                dataKey="orderCount"
                name="訂單數"
                stroke="#a0845c"
                strokeWidth={1.5}
                strokeDasharray="5 5"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── 服務銷售 Top 5 ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-stone-200 rounded-xl p-5">
          <SectionTitle>服務銷售 Top 5（營收）</SectionTitle>
          {top5Services.length === 0 ? (
            <p className="text-stone-400 text-sm text-center py-12">
              此期間無資料
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                layout="vertical"
                data={top5Services}
                margin={{ top: 0, right: 16, bottom: 0, left: 8 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#f0ece8"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: '#78716c' }}
                  tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                />
                <YAxis
                  type="category"
                  dataKey="serviceName"
                  tick={{ fontSize: 11, fill: '#44403c' }}
                  width={90}
                />
                <Tooltip formatter={(v: number) => ntd(v)} />
                <Bar dataKey="revenue" name="營收" radius={[0, 4, 4, 0]}>
                  {top5Services.map((_, i) => (
                    <Cell key={i} fill={WARM_COLORS[i] ?? BROWN} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* 服務銷售明細表 */}
        <div className="bg-white border border-stone-200 rounded-xl p-5">
          <SectionTitle>銷售明細</SectionTitle>
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {services.slice(0, 10).map((s, i) => (
              <div
                key={s.serviceId}
                className="flex items-center justify-between text-sm"
              >
                <span className="flex items-center gap-2">
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-xs text-white font-bold"
                    style={{ backgroundColor: WARM_COLORS[i] ?? BROWN }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-stone-700 truncate max-w-[120px]">
                    {s.serviceName}
                  </span>
                </span>
                <span className="text-stone-500 text-xs whitespace-nowrap">
                  {s.count} 次 · {ntd(s.revenue)}
                </span>
              </div>
            ))}
            {services.length === 0 && (
              <p className="text-stone-400 text-sm text-center py-4">無資料</p>
            )}
          </div>
        </div>
      </div>

      {/* ── 預約來源 + 服務類別 ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 預約來源圓餅圖 */}
        <div className="bg-white border border-stone-200 rounded-xl p-5">
          <SectionTitle>預約來源分布</SectionTitle>
          {bookingSources.length === 0 ? (
            <p className="text-stone-400 text-sm text-center py-12">
              此期間無資料
            </p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={bookingSources.map((s) => ({
                      name: SOURCE_LABELS[s.source] ?? s.source,
                      value: s.count,
                    }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="value"
                    paddingAngle={3}
                  >
                    {bookingSources.map((s, i) => (
                      <Cell
                        key={s.source}
                        fill={
                          SOURCE_COLORS_HEX[s.source] ?? WARM_COLORS[i] ?? BROWN
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v} 筆`} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-3 pt-3 border-t border-stone-100 grid grid-cols-2 gap-2">
                {bookingSources.map((s) => {
                  const total = bookingSources.reduce(
                    (sum, x) => sum + x.count,
                    0,
                  )
                  const pct =
                    total > 0 ? Math.round((s.count / total) * 100) : 0
                  return (
                    <div
                      key={s.source}
                      className="flex items-center justify-between text-sm px-1"
                    >
                      <span
                        className="text-xs font-medium"
                        style={{
                          color: SOURCE_COLORS_HEX[s.source] ?? '#78716c',
                        }}
                      >
                        {SOURCE_LABELS[s.source] ?? s.source}
                      </span>
                      <span className="text-stone-500 text-xs">
                        {s.count} 筆 ({pct}%)
                      </span>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* 服務類別收入長條圖 */}
        <div className="bg-white border border-stone-200 rounded-xl p-5">
          <SectionTitle>服務類別收入</SectionTitle>
          {categoryRevenue.length === 0 ? (
            <p className="text-stone-400 text-sm text-center py-12">
              此期間無資料
            </p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  layout="vertical"
                  data={categoryRevenue.map((c) => ({
                    ...c,
                    categoryLabel: CATEGORY_LABELS[c.category] ?? c.category,
                  }))}
                  margin={{ top: 0, right: 16, bottom: 0, left: 8 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#f0ece8"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: '#78716c' }}
                    tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <YAxis
                    type="category"
                    dataKey="categoryLabel"
                    tick={{ fontSize: 11, fill: '#44403c' }}
                    width={50}
                  />
                  <Tooltip formatter={(v: number) => ntd(v)} />
                  <Bar dataKey="revenue" name="收入" radius={[0, 4, 4, 0]}>
                    {categoryRevenue.map((c, i) => (
                      <Cell
                        key={c.category}
                        fill={CATEGORY_COLORS[i] ?? BROWN}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-3 pt-3 border-t border-stone-100 space-y-1.5">
                {categoryRevenue.map((c, i) => (
                  <div
                    key={c.category}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: CATEGORY_COLORS[i] ?? BROWN }}
                      />
                      <span className="text-stone-700">
                        {CATEGORY_LABELS[c.category] ?? c.category}
                      </span>
                    </span>
                    <span className="text-stone-500 text-xs">
                      {c.count} 次 · {ntd(c.revenue)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── 客戶分析 + 美容師績效 ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 客戶分析 */}
        <div className="bg-white border border-stone-200 rounded-xl p-5">
          <SectionTitle>客戶分析</SectionTitle>
          <div className="grid grid-cols-2 gap-4">
            {/* 新客 vs 回頭客 */}
            <div>
              <p className="text-xs text-stone-500 text-center mb-2">
                新客 vs 回頭客
              </p>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={customerTypePie}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={65}
                    dataKey="value"
                    paddingAngle={3}
                  >
                    <Cell fill={PIE_NEW} />
                    <Cell fill={PIE_RETURN} />
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v} 人`} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* 會員 vs 非會員（訂單占比） */}
            <div>
              <p className="text-xs text-stone-500 text-center mb-2">
                會員消費占比
              </p>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={memberPie}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={65}
                    dataKey="value"
                    paddingAngle={3}
                  >
                    <Cell fill={PIE_MEMBER} />
                    <Cell fill={PIE_NONMEMBER} />
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v} 筆`} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          {/* 會員收入比較 */}
          <div className="mt-3 pt-3 border-t border-stone-100 grid grid-cols-2 gap-3 text-center text-sm">
            <div>
              <p className="text-stone-500 text-xs">會員收入</p>
              <p className="font-semibold text-stone-800">
                {ntd(customers.memberRevenue)}
              </p>
            </div>
            <div>
              <p className="text-stone-500 text-xs">非會員收入</p>
              <p className="font-semibold text-stone-800">
                {ntd(customers.nonMemberRevenue)}
              </p>
            </div>
          </div>
        </div>

        {/* 美容師績效 */}
        <div className="bg-white border border-stone-200 rounded-xl p-5">
          <SectionTitle>美容師績效</SectionTitle>
          {staff.length === 0 ? (
            <p className="text-stone-400 text-sm text-center py-12">
              此期間無資料
            </p>
          ) : (
            <div className="space-y-3">
              {staff.map((s, i) => {
                const maxRevenue = staff[0]?.revenue ?? 1
                const pct = Math.round((s.revenue / maxRevenue) * 100)
                return (
                  <div key={s.staffId}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="flex items-center gap-2">
                        <span className="text-xs text-stone-400 w-4">
                          {i + 1}
                        </span>
                        <span className="font-medium text-stone-700">
                          {s.staffName}
                        </span>
                      </span>
                      <span className="text-stone-500 text-xs">
                        {s.orderCount} 筆 · {ntd(s.revenue)} · 均{' '}
                        {ntd(s.avgOrderValue)}
                      </span>
                    </div>
                    <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: WARM_COLORS[i] ?? BROWN,
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
