import { ICON_PATHS, type IconName } from './icons'
import './Icon.css'

interface IconProps {
  name: IconName
  /** 'sm' = 14px. Leave empty for the normal 18px size. */
  size?: 'sm' | 'md'
  className?: string
}

/**
 * <Icon name="cart" /> draws one of the prototype's line icons.
 * The colour follows the text colour of the parent (currentColor),
 * so a button's colour automatically colours its icon.
 */
export function Icon({ name, size = 'md', className = '' }: IconProps) {
  return (
    <svg
      className={`ico ${size === 'sm' ? 'sm' : ''} ${className}`.trim()}
      viewBox="0 0 24 24"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] }}
    />
  )
}
