import Link from 'next/link'
import { PosLayout } from '@/components/layout/PosLayout'

export default function Home() {
  return (
    <PosLayout>
      <div className="max-w-xl mx-auto flex flex-col gap-6 pt-8">
        <div>
          <p className="text-sm font-medium text-emerald-700">寵物美容 POS</p>
          <h1 className="mt-2 text-4xl font-bold text-stone-900">
            今天，好好愛牠
          </h1>
          <p className="mt-3 text-stone-500 text-lg">選擇操作項目</p>
        </div>

        <div className="grid grid-cols-1 gap-4 mt-4">
          <Link
            href="/checkin"
            className="flex items-center gap-4 rounded-xl bg-emerald-700 text-white px-6 py-5 hover:bg-emerald-800 active:bg-emerald-900 transition-colors focus:outline-none focus:ring-4 focus:ring-emerald-200"
          >
            <div className="w-12 h-12 rounded-lg bg-emerald-600 flex items-center justify-center text-xl font-bold flex-shrink-0">
              01
            </div>
            <div>
              <p className="font-bold text-xl">報到簽約</p>
              <p className="text-emerald-200 text-sm">
                客戶報到、選服務、電子簽名
              </p>
            </div>
          </Link>

          <Link
            href="/booking/onsite"
            className="flex items-center gap-4 rounded-xl border border-stone-200 bg-white px-6 py-5 hover:bg-stone-50 active:bg-stone-100 transition-colors focus:outline-none focus:ring-4 focus:ring-emerald-200"
          >
            <div className="w-12 h-12 rounded-lg bg-stone-100 flex items-center justify-center text-stone-600 flex-shrink-0">
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
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 14v3m0 0h-1.5M12 17h1.5"
                />
              </svg>
            </div>
            <div>
              <p className="font-bold text-xl text-stone-800">現場預約</p>
              <p className="text-stone-400 text-sm">
                幫客戶預約未來時段（不簽約）
              </p>
            </div>
          </Link>

          <Link
            href="/schedule"
            className="flex items-center gap-4 rounded-xl border border-stone-200 bg-white px-6 py-5 hover:bg-stone-50 active:bg-stone-100 transition-colors focus:outline-none focus:ring-4 focus:ring-emerald-200"
          >
            <div className="w-12 h-12 rounded-lg bg-stone-100 flex items-center justify-center text-stone-600 flex-shrink-0">
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
            </div>
            <div>
              <p className="font-bold text-xl text-stone-800">預約時間表</p>
              <p className="text-stone-400 text-sm">今日排班、預約管理</p>
            </div>
          </Link>

          <Link
            href="/member"
            className="flex items-center gap-4 rounded-xl border border-stone-200 bg-white px-6 py-5 hover:bg-stone-50 active:bg-stone-100 transition-colors focus:outline-none focus:ring-4 focus:ring-emerald-200"
          >
            <div className="w-12 h-12 rounded-lg bg-stone-100 flex items-center justify-center text-stone-600 flex-shrink-0">
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
            </div>
            <div>
              <p className="font-bold text-xl text-stone-800">會員查詢</p>
              <p className="text-stone-400 text-sm">會員資料、點數、儲值</p>
            </div>
          </Link>
        </div>
      </div>
    </PosLayout>
  )
}
