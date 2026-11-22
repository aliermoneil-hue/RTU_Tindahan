import type { ButtonHTMLAttributes } from 'react'
import { MiniLoader } from '@/common/components/BrandLoader'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'yellow'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
}

/** Maps Button props to the project's existing CSS button classes (.btn, .btn.yellow, etc.) */
const variantClasses: Record<string, string> = {
  primary: 'btn',
  secondary: 'btn',
  outline: 'btn ghost',
  ghost: 'btn ghost',
  yellow: 'btn yellow',
}

const sizeClasses: Record<string, string> = {
  sm: 'btn sm',
  md: 'btn',
  lg: 'btn lg',
}

export function Button({
  children,
  className = '',
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={[
        variantClasses[variant],
        sizeClasses[size],
        isLoading || disabled ? 'opacity-60 cursor-not-allowed' : '',
        className,
      ].join(' ').trim()}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading ? (
        <MiniLoader variant="inline" size="sm" />
      ) : (
        children
      )}
    </button>
  )
}
