import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * primary   = blue (main action)
   * yellow    = yellow accent (big call-to-action)
   * secondary = light blue tint
   * outline / ghost = white with a border
   * danger    = red tint
   */
  variant?: 'primary' | 'yellow' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  /** Stretch to the full width of its container. */
  block?: boolean
  isLoading?: boolean
}

/** Maps our prop names to the prototype's CSS classes (see styles/components.css). */
const variantClass: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: '',
  yellow: 'yellow',
  secondary: 'soft',
  outline: 'ghost',
  ghost: 'ghost',
  danger: 'danger',
}

const sizeClass: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'sm',
  md: '',
  lg: 'lg',
}

/**
 * The one button used everywhere. Example:
 *   <Button variant="yellow" size="lg">Create account</Button>
 * Because it only adds CSS classes, it works with normal props such as
 * onClick, type="submit" and disabled.
 */
export function Button({
  children,
  className = '',
  variant = 'primary',
  size = 'md',
  block = false,
  isLoading = false,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  const classes = ['btn', variantClass[variant], sizeClass[size], block ? 'block' : '', className]
    .filter(Boolean)
    .join(' ')

  return (
    <button className={classes} type={type} disabled={disabled || isLoading} {...props}>
      {isLoading && <span>Please wait...</span>}
      {!isLoading && children}
    </button>
  )
}
