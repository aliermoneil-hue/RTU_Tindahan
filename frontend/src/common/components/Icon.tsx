import type { CSSProperties } from 'react'
import { ICON_PATHS, type IconName } from './icons'
import './Icon.css'

interface IconProps {
  name: IconName
  /** 'sm' = 14px, 'md' = 18px, or a pixel number (e.g. 16, 24). */
  size?: 'sm' | 'md' | number
  className?: string
  style?: CSSProperties
}

/**
 * <Icon name="cart" /> draws one of the prototype's line icons.
 * The colour follows the text colour of the parent (currentColor),
 * so a button's colour automatically colours its icon.
 */
export function Icon({ name, size = 'md', className = '', style }: IconProps) {
  const numStyle: CSSProperties | undefined =
    typeof size === 'number' ? { width: size, height: size, ...style } : style

  return (
    <svg
      className={`ico ${size === 'sm' ? 'sm' : ''} ${className}`.trim()}
      style={numStyle}
      viewBox="0 0 24 24"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] }}
    />
  )
}
