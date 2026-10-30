import type { ReactNode } from 'react'
import { Icon } from './Icon'
import type { IconName } from './icons'

interface EmptyStateProps {
  icon?: IconName
  title: string
  children?: ReactNode
  /** Optional button or link shown under the text. */
  action?: ReactNode
}

/** A friendly "nothing here yet" box. Use it whenever a list has no items. */
export function EmptyState({ icon = 'bag', title, children, action }: EmptyStateProps) {
  return (
    <div className="card stack" style={{ alignItems: 'center', textAlign: 'center', padding: 34 }}>
      <span style={{ color: 'var(--blue)' }}>
        <Icon name={icon} />
      </span>
      <b>{title}</b>
      {children && <p className="small muted">{children}</p>}
      {action}
    </div>
  )
}
