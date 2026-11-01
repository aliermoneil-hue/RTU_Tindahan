import type { ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import { Link, useLocation } from '../lib/router'
import { ROLE_LABEL } from '../lib/types'
import { initials } from '../lib/format'
import { ThemeToggle } from './ThemeToggle'

interface NavItem {
  to: string
  label: string
  match: (path: string, search: URLSearchParams) => boolean
  show: boolean
  count?: number
}

export function Layout({ children }: { children: ReactNode }) {
  const { user, abilities, logout } = useAuth()
  const { path, search } = useLocation()
  if (!user) return null

  const queue = search.get('verified') === 'false'
  const items: NavItem[] = [
    { to: '/', label: 'Dashboard', match: (p) => p === '/', show: abilities.dashboard },
    {
      to: '/accounts',
      label: 'Accounts',
      match: (p) => p.startsWith('/accounts') && !queue,
      show: abilities.viewAccounts,
    },
    {
      to: '/accounts?verified=false',
      label: 'Verification queue',
      match: (p) => p.startsWith('/accounts') && queue,
      show: abilities.verifyAccounts,
    },
  ]

  return (
    <div className="shell">
      <aside className="sidebar" aria-label="Main">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">RT</span>
          <span className="brand-text">
            <strong>RTU Tindahan</strong>
            <small>Admin</small>
          </span>
        </div>
        <nav>
          {items
            .filter((item) => item.show)
            .map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="nav-link"
                aria-current={item.match(path, search) ? 'page' : undefined}
              >
                {item.label}
              </Link>
            ))}
        </nav>
        <div className="sidebar-foot">
          <div className="me">
            <span className="avatar" aria-hidden="true">{initials(user.display_name)}</span>
            <span className="me-text">
              <strong>{user.display_name}</strong>
              <small>{ROLE_LABEL[user.role]}</small>
            </span>
          </div>
          <ThemeToggle />
          <button type="button" className="btn btn-quiet" onClick={() => void logout()}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  )
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  )
}
