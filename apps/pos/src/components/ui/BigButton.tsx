import { ButtonHTMLAttributes, forwardRef } from 'react'

interface BigButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger'
  fullWidth?: boolean
}

export const BigButton = forwardRef<HTMLButtonElement, BigButtonProps>(
  (
    {
      variant = 'primary',
      fullWidth = false,
      className = '',
      children,
      ...props
    },
    ref,
  ) => {
    const base =
      'min-h-[56px] rounded-xl px-6 text-lg font-semibold transition-opacity disabled:opacity-40'
    const variants = {
      primary: 'bg-emerald-700 text-white active:bg-emerald-800',
      secondary:
        'bg-stone-100 text-stone-800 border border-stone-300 active:bg-stone-200',
      danger: 'bg-red-600 text-white active:bg-red-700',
    }
    return (
      <button
        ref={ref}
        className={[
          base,
          variants[variant],
          fullWidth ? 'w-full' : '',
          className,
        ].join(' ')}
        {...props}
      >
        {children}
      </button>
    )
  },
)
BigButton.displayName = 'BigButton'
