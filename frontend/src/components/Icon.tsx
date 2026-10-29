import { ICONS } from '../icons'

/* One small line icon. The shapes come from icons.ts. */
export default function Icon({ name, small = false, className = '' }: { name: string; small?: boolean; className?: string }) {
  return (
    <svg
      className={`ico ${small ? 'sm' : ''} ${className}`.trim()}
      viewBox="0 0 24 24"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: ICONS[name] ?? '' }}
    />
  )
}
