import { useState } from 'react'
import { Icon } from '@/common/components/Icon'
import { Link, navigate } from '@/common/router/router'
import { useTheme } from '@/common/hooks/useTheme'
import { useAuth } from '@/features/authentication'
import type { User } from '@/common/types'
import './Topbar.css'

const MEMBER_LABEL: Record<User['member_type'], string> = {
  student: 'Student',
  faculty: 'Faculty',
  personnel: 'Personnel',
}

/** "Juan Dela Cruz" -> "JD" (shown inside the round avatar). */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

interface TopbarProps {
  user: User
  onMenuClick: () => void
}

/**
 * TOP BAR for signed-in pages: menu button (phones), search, messages,
 * notifications, cart and the user menu.
 * Message / notification / cart numbers are not shown yet because the
 * backend has no endpoints for them.
 */
export function Topbar({ user, onMenuClick }: TopbarProps) {
  const { logout } = useAuth()
  const { theme, toggle } = useTheme()
  const [open, setOpen] = useState<'' | 'bell' | 'user'>('')
  const [query, setQuery] = useState('')

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    navigate(q ? `browse?q=${encodeURIComponent(q)}` : 'browse')
  }

  const toggleMenu = (which: 'bell' | 'user') => setOpen((cur) => (cur === which ? '' : which))

  return (
    <header className="top">
      <button type="button" className="menu-btn" aria-label="Open menu" onClick={onMenuClick}>
        <Icon name="menu" />
      </button>

      <form className="search" role="search" onSubmit={submitSearch}>
        <Icon name="search" size="sm" />
        <input
          placeholder="Search the Pasig Campus marketplace..."
          aria-label="Search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </form>

      <span className="grow" />

      <Link to="messages" className="iconbtn" aria-label="Messages">
        <Icon name="msg" />
      </Link>

      <div className="rel">
        <button
          type="button"
          className={`iconbtn ${open === 'bell' ? 'is-open' : ''}`}
          aria-label="Notifications"
          aria-haspopup="true"
          aria-expanded={open === 'bell'}
          onClick={() => toggleMenu('bell')}
        >
          <Icon name="bell" />
        </button>
        {open === 'bell' && (
          <div className="menu" role="region" aria-label="Notifications">
            <div style={{ padding: '6px 10px' }}>
              <b>Notifications</b>
            </div>
            <div className="small muted" style={{ padding: 12 }}>
              Nothing yet. Updates about your requests show up here.
            </div>
          </div>
        )}
      </div>

      <Link to="cart" className="iconbtn" aria-label="Request cart">
        <Icon name="cart" />
      </Link>

      <div className="rel">
        <button
          type="button"
          className="userbtn"
          aria-haspopup="true"
          aria-expanded={open === 'user'}
          onClick={() => toggleMenu('user')}
        >
          <span className="avatar">{initials(user.display_name)}</span>
          <span className="userbtn-text">
            <b>{user.display_name}</b>
            <span>{MEMBER_LABEL[user.member_type]} · Pasig</span>
          </span>
        </button>
        {open === 'user' && (
          <div className="menu" role="menu">
            <div style={{ padding: '8px 10px' }}>
              <b style={{ fontSize: 13 }}>{user.display_name}</b>
              <div className="tiny muted" style={{ overflowWrap: 'anywhere' }}>{user.email}</div>
            </div>
            <hr />
            <Link to="profile" className="mi" role="menuitem" onClick={() => setOpen('')}>
              <Icon name="user" /> My profile
            </Link>
            <Link to="favorites" className="mi" role="menuitem" onClick={() => setOpen('')}>
              <Icon name="heart" /> Favorites
            </Link>
            <button type="button" className="mi" role="menuitem" onClick={toggle}>
              <Icon name="moon" /> {theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            </button>
            <hr />
            <button
              type="button"
              className="mi"
              role="menuitem"
              onClick={() => {
                setOpen('')
                void logout().then(() => navigate(''))
              }}
            >
              <Icon name="logout" /> Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
