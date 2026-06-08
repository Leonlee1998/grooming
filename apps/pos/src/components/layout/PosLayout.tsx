import { ReactNode } from 'react'

interface PosLayoutProps {
  children: ReactNode
}

export function PosLayout({ children }: PosLayoutProps) {
  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      <header className="bg-white border-b border-stone-200 px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-700 flex items-center justify-center text-white font-bold text-sm">
          P
        </div>
        <span className="font-semibold text-stone-800 text-lg">
          寵物美容 POS
        </span>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
