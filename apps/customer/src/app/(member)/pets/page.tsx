import type { Metadata } from 'next'

export const metadata: Metadata = { title: '我的寵物' }

export default function PetsPage() {
  return (
    <div className="px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-brand-900">我的寵物</h1>
        <button
          type="button"
          className="text-sm text-brand-700 font-medium px-3 py-1.5 rounded-lg border border-brand-700 active:bg-brand-50 transition-colors"
        >
          + 新增
        </button>
      </div>
      <div className="space-y-3">
        <p className="text-sm text-gray-500 text-center py-12">
          尚未新增寵物資料
        </p>
      </div>
    </div>
  )
}
