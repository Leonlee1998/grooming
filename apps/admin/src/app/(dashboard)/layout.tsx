import { ReactNode } from 'react'
import { NavMenu } from '@/components/layout/NavLink'

const navItems = [
  { href: '/dashboard', label: '今日總覽' },
  { href: '/services', label: '服務管理' },
  { href: '/appointments', label: '預約管理' },
  { href: '/orders', label: '訂單查詢' },
  { href: '/customers', label: '客戶管理' },
  { href: '/members', label: '會員管理' },
  { href: '/reports', label: '營收報表' },
  { href: '/settings', label: '系統設定' },
]

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 flex w-60 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-6 py-5">
          <p className="font-bold text-slate-900">寵物美容 POS</p>
          <p className="mt-0.5 text-xs text-slate-400">後台管理</p>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-0.5">
            <NavMenu items={navItems} />
          </ul>
        </nav>
      </aside>
      <div className="flex-1 pl-60">
        <main className="p-8">{children}</main>
      </div>
    </div>
  )
}
