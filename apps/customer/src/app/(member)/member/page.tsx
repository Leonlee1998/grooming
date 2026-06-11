import type { Metadata } from 'next'

export const metadata: Metadata = { title: '會員資訊' }

export default function MemberPage() {
  return (
    <div className="px-4 py-6 space-y-6">
      <h1 className="text-xl font-bold text-brand-900">會員資訊</h1>

      {/* 會員卡佔位 */}
      <div className="rounded-2xl bg-gradient-to-br from-brand-700 to-brand-900 text-white p-5 space-y-3">
        <div className="text-sm opacity-75">一般會員</div>
        <div className="text-2xl font-bold">— 點</div>
        <div className="text-sm opacity-75">儲值餘額：— 元</div>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          帳號
        </h2>
        <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
          <div className="px-4 py-3 flex justify-between items-center">
            <span className="text-sm text-gray-700">手機號碼</span>
            <span className="text-sm text-gray-400">—</span>
          </div>
          <div className="px-4 py-3 flex justify-between items-center">
            <span className="text-sm text-gray-700">LINE 帳號</span>
            <span className="text-sm text-gray-400">未綁定</span>
          </div>
        </div>
      </div>

      <button
        type="button"
        className="w-full py-3 rounded-xl text-sm text-red-500 border border-red-200 active:bg-red-50 transition-colors"
      >
        登出
      </button>
    </div>
  )
}
