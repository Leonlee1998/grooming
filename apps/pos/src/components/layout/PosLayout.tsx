'use client'

import { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface PosLayoutProps {
  children: ReactNode
}

const NAV_TABS = [
  {
    href: '/checkin',
    label: '報到',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        className="w-6 h-6"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    ),
  },
  {
    href: '/schedule',
    label: '時間表',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        className="w-6 h-6"
      >
        <rect
          x="3"
          y="4"
          width="18"
          height="18"
          rx="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16 2v4M8 2v4M3 10h18"
        />
      </svg>
    ),
  },
  {
    href: '/member',
    label: '會員',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        className="w-6 h-6"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
  {
    href: '/service-board',
    label: '服務看板',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        className="w-6 h-6"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
        />
      </svg>
    ),
  },
]

export function PosLayout({ children }: PosLayoutProps) {
  const pathname = usePathname()

  function isActive(href: string) {
    if (href === '/checkin') return pathname.startsWith('/checkin')
    if (href === '/schedule') return pathname.startsWith('/schedule')
    if (href === '/member') return pathname.startsWith('/member')
    if (href === '/service-board') return pathname.startsWith('/service-board')
    return pathname === href
  }

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 px-6 py-4">
        <Link
          href="/"
          className="inline-flex min-h-[44px] items-center gap-3 rounded-xl pr-3 transition-colors active:bg-stone-100"
        >
          <div className="w-8 h-8 rounded-lg bg-emerald-700 flex items-center justify-center text-white font-bold text-sm">
            P
          </div>
          <span className="font-semibold text-stone-800 text-lg">
            寵物美容 POS
          </span>
        </Link>
      </header>

      {/* Main content */}
      <main className="flex-1 p-6 pb-24">{children}</main>

      {/* Bottom Tab Bar */}
      <nav className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-stone-200">
        <div className="flex h-16">
          {NAV_TABS.map((tab) => {
            const active = isActive(tab.href)
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={[
                  'relative flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[56px] transition-colors',
                  active
                    ? 'text-emerald-700'
                    : 'text-stone-400 hover:text-stone-600 active:text-stone-800',
                ].join(' ')}
              >
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-emerald-700 rounded-b" />
                )}
                {tab.icon}
                <span
                  className={[
                    'text-[11px]',
                    active ? 'font-semibold' : 'font-medium',
                  ].join(' ')}
                >
                  {tab.label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
