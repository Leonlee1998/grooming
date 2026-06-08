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
            className="flex items-center gap-4 rounded-lg bg-emerald-700 text-white px-6 py-5 hover:bg-emerald-800 active:bg-emerald-900 transition-colors focus:outline-none focus:ring-4 focus:ring-emerald-200"
          >
            <div className="w-12 h-12 rounded-lg bg-emerald-600 flex items-center justify-center text-xl font-bold">
              01
            </div>
            <div>
              <p className="font-bold text-xl">報到簽約</p>
              <p className="text-emerald-200 text-sm">
                客戶報到、選服務、電子簽名
              </p>
            </div>
          </Link>

          <div className="rounded-lg border border-stone-200 bg-white px-6 py-4 text-stone-500">
            預約時間表與會員查詢尚未建立路由，暫不顯示為入口。
          </div>
        </div>
      </div>
    </PosLayout>
  )
}
