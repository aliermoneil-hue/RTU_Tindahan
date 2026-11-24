import { useEffect, useState } from 'react'
import { Icon } from '@/common/components/Icon'
import { Link, navigate } from '@/common/router/router'
import { ThemeToggle } from '@/common/components/ThemeToggle'
import { useAuth } from '@/features/authentication'
import type { User } from '@/common/types'
import { ago, initialsOf } from '@/features/marketplace/constants'
import { useTindahan } from '@/features/marketplace/context/TindahanContext'
import { imgSrc } from '@/features/marketplace/imageStore'
import logoImg from '@/assets/logo-removebg-preview.png'
import './Topbar.css'

const MEMBER_LABEL: Record<User['member_type'], string> = {
  student: 'Student',
  faculty: 'Faculty',
  personnel: 'Personnel',
}

interface TopbarProps {
  user: User
  onMenuClick: () => void
  onCloseMobileMenu?: () => void
}

/**
 * TOP BAR for signed-in pages: menu button (phones), search, messages,
 * notifications, cart and the user menu.
 */
export function Topbar({ user, onMenuClick, onCloseMobileMenu }: TopbarProps) {
  const { logout } = useAuth()
  const {
    currentAccount,
    isStaffUser,
    canModerate,
    cartCount,
    unreadMessagesCount,
    browseState,
    browseFor,
    markAllNotifsRead,
    openNotification,
  } = useTindahan()

  const [open, setOpen] = useState<'' | 'bell' | 'user'>('')
  const [query, setQuery] = useState(browseState.q || '')

  useEffect(() => {
    setQuery(browseState.q || '')
  }, [browseState.q])

  useEffect(() => {
    if (!open) return
    const onDocClick = () => setOpen('')
    window.addEventListener('click', onDocClick)
    return () => window.removeEventListener('click', onDocClick)
  }, [open])

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    browseFor({ q, goBrowse: true })
    onCloseMobileMenu?.()
  }

  const toggleMenu = (which: 'bell' | 'user') => setOpen((cur) => (cur === which ? '' : which))

  const notifs = currentAccount?.notifs || []
  const unreadNotifs = notifs.filter((n) => !n.read).length
  const displayName = currentAccount?.name || user.display_name
  const avatarSrc =
    (currentAccount?.avatar ? imgSrc(currentAccount.avatar) : null) || user.profile_photo || null
  const init = initialsOf(displayName)
  const subLabel = currentAccount?.aff || MEMBER_LABEL[user.member_type] || 'Student'

  return (
    <header className="top">
      <div className="top-start">
        <Link
          to="marketplace"
          className="logo-link"
          aria-label="RTU Tindahan Home"
          onClick={() => {
            setOpen('')
            onCloseMobileMenu?.()
          }}
        >
          <img src={logoImg} alt="RTU Tindahan" className="topbar-logo" />
        </Link>
        <button
          type="button"
          className="menu-btn"
          aria-label="Open menu"
          onClick={() => {
            setOpen('')
            onMenuClick()
          }}
        >
          <Icon name="menu" />
        </button>
      </div>

      <form className="search" role="search" onSubmit={submitSearch}>
        <Icon name="search" size="sm" />
        <input
          placeholder="Search textbooks, uniforms, calculators or course codes..."
          aria-label="Search marketplace"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => onCloseMobileMenu?.()}
        />
      </form>

      <div className="top-end">
        <div className="right-actions">
          <div className="rel" onClick={(e) => { e.stopPropagation(); setOpen(''); onCloseMobileMenu?.() }}>
            <ThemeToggle />
          </div>
          <Link
            to="messages"
            className="iconbtn"
            aria-label="Messages"
            title="Messages"
            onClick={() => {
              setOpen('')
              onCloseMobileMenu?.()
            }}
          >
            <Icon name="msg" />
            {unreadMessagesCount > 0 && <span className="dot">{unreadMessagesCount}</span>}
          </Link>

          <div className="rel" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={`iconbtn bellbtn ${open === 'bell' ? 'is-open' : ''}`.trim()}
              aria-label="Notifications"
              aria-haspopup="true"
              aria-expanded={open === 'bell'}
              onClick={() => {
                toggleMenu('bell')
                onCloseMobileMenu?.()
              }}
            >
              <Icon name="bell" />
              {unreadNotifs > 0 && <span className="dot">{unreadNotifs}</span>}
            </button>
            {open === 'bell' && (
              <div className="menu notif-menu" role="region" aria-label="Notifications">
                <div className="row between" style={{ padding: '6px 10px' }}>
                  <b className="small">Notifications</b>
                  {unreadNotifs > 0 && (
                    <button
                      type="button"
                      className="link"
                      onClick={() => markAllNotifsRead()}
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <hr />
                {notifs.length ? (
                  notifs.slice(0, 12).map((n, i) => (
                    <button
                      key={i}
                      type="button"
                      className={`mi notif ${n.read ? 'read' : 'unread'}`}
                      onClick={() => {
                        setOpen('')
                        openNotification(i)
                      }}
                    >
                      <span className="nbul" aria-hidden="true" />
                      <span className="grow">
                        <span className="ntxt">{n.t}</span>
                        <span className="tiny muted">{n.at ? ago(n.at) : n.ts}</span>
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="small muted" style={{ padding: 12 }}>
                    Nothing yet. Updates about your requests show up here.
                  </div>
                )}
              </div>
            )}
          </div>

          <Link
            to="cart"
            className="iconbtn"
            aria-label="Pickup cart"
            title="Pickup cart"
            onClick={() => {
              setOpen('')
              onCloseMobileMenu?.()
            }}
          >
            <Icon name="cart" />
            {cartCount > 0 && <span className="dot">{cartCount}</span>}
          </Link>

          <div className="rel" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="userbtn"
              aria-haspopup="true"
              aria-expanded={open === 'user'}
              onClick={() => {
                toggleMenu('user')
                onCloseMobileMenu?.()
              }}
            >
              <span className="avw av-sm">
                <span className={`avatar ${isStaffUser ? 'staff' : ''}`.trim()}>
                  {avatarSrc ? <img className="avimg" src={avatarSrc} alt={displayName} /> : init}
                </span>
              </span>
              <span className="user-text-slot">
                <b title={displayName} className="user-name">
                  {displayName}
                </b>
                <span title={`${subLabel} · Pasig`} className="user-sub">
                  {subLabel} · Pasig
                </span>
              </span>
            </button>
            {open === 'user' && (
              <div className="menu" role="menu">
                <div style={{ padding: '8px 10px' }}>
                  <b style={{ fontSize: 13 }}>{displayName}</b>
                  <div className="tiny muted" style={{ overflowWrap: 'anywhere' }}>
                    {currentAccount?.email || user.email} · {currentAccount?.sid || user.id}
                  </div>
                </div>
                <hr />
                <Link to="profile" className="mi" role="menuitem" onClick={() => setOpen('')}>
                  <Icon name="user" /> My profile
                </Link>
                <Link to="orders" className="mi" role="menuitem" onClick={() => setOpen('')}>
                  <Icon name="order" /> My orders
                </Link>
                <Link to="shop" className="mi" role="menuitem" onClick={() => setOpen('')}>
                  <Icon name="shop" /> {isStaffUser ? 'Admin | RTU Shop' : 'My shop'}
                </Link>
                <Link to="favorites" className="mi" role="menuitem" onClick={() => setOpen('')}>
                  <Icon name="heart" /> Favorites ({currentAccount?.favs.length || 0})
                </Link>
                <Link to="messages" className="mi" role="menuitem" onClick={() => setOpen('')}>
                  <Icon name="msg" /> Messages
                  {unreadMessagesCount > 0 ? ` (${unreadMessagesCount})` : ''}
                </Link>
                <Link to="help" className="mi" role="menuitem" onClick={() => setOpen('')}>
                  <Icon name="info" /> Help Center & Manual
                </Link>
                {isStaffUser && (
                  <>
                    <hr />
                    {canModerate && (
                      <Link to="moderation" className="mi" role="menuitem" onClick={() => setOpen('')}>
                        <Icon name="flag" /> Listing approval
                      </Link>
                    )}
                    <Link to="staff" className="mi" role="menuitem" onClick={() => setOpen('')}>
                      <Icon name="sliders" /> Staff tools
                    </Link>
                  </>
                )}
                <hr />
                <button
                  type="button"
                  className="mi"
                  role="menuitem"
                  style={{ color: 'var(--red)' }}
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
        </div>
      </div>
    </header>
  )
}
