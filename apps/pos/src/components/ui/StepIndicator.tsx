'use client'

interface StepIndicatorProps {
  current: number
  total: number
  labels: string[]
}

export function StepIndicator({ current, total, labels }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-0 w-full">
      {Array.from({ length: total }).map((_, i) => {
        const step = i + 1
        const done = step < current
        const active = step === current
        return (
          <div key={step} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div
                className={[
                  'w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-colors',
                  done ? 'bg-emerald-700 text-white' : '',
                  active
                    ? 'bg-emerald-700 text-white ring-4 ring-emerald-200'
                    : '',
                  !done && !active ? 'bg-stone-200 text-stone-500' : '',
                ].join(' ')}
              >
                {done ? '✓' : step}
              </div>
              <span
                className={[
                  'text-xs whitespace-nowrap',
                  active ? 'text-emerald-800 font-semibold' : 'text-stone-400',
                ].join(' ')}
              >
                {labels[i]}
              </span>
            </div>
            {i < total - 1 && (
              <div
                className={[
                  'h-0.5 flex-1 mx-1 mb-4',
                  done ? 'bg-emerald-700' : 'bg-stone-200',
                ].join(' ')}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
