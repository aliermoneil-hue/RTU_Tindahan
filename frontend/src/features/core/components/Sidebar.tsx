import { useState, useEffect, useRef } from 'react'
import { Icon } from '@/common/components/Icon'
import { Link } from '@/common/router/router'
import type { Role } from '@/common/types'
import { baoIsOfficialTxn, baoLowUnits, baoStatusOf } from '@/features/marketplace/baoHelpers'
import { FR_STATUS } from '@/features/marketplace/constants'
import { useTindahan } from '@/features/marketplace/context/TindahanContext'
import { APP_PAGES, NAV_SECTIONS, canSeeAdmin } from '../routes'
import './Sidebar.css'

interface SidebarProps {
  /** path of the page being shown, e.g. "browse" */
  activePath: string
  role: Role
  /** phone/tablet: is the slide-out drawer open? */
  open: boolean
  /** desktop: is the sidebar expanded? */
  isOpen: boolean
  onClose: () => void
  onToggle: () => void
}

const PATH_ALIASES: Record<string, string> = {
  market: 'marketplace',
  official: 'store',
  sellers: 'student-sellers',
  list: 'create',
  seller: 'shop',
  forumreports: 'forum-reports',
  'store-orders': 'baoorders',
  'store-inventory': 'baostock',
  post: 'forum',
  confirm: 'orders',
}

/**
 * NAVY SIDEBAR for signed-in pages. Menu items come from APP_PAGES (routes.ts).
 * On small screens it becomes a drawer opened by the hamburger button.
 * Sections are collapsible accordions; the yellow scrollbar appears on hover.
 */
export function Sidebar({ activePath, role, open, isOpen, onClose, onToggle }: SidebarProps) {
  const { db, currentAccount, isStaffUser, clearBrowseFilters } = useTindahan()

  const normalizedActive = PATH_ALIASES[activePath] || activePath
  const showAdmin = isStaffUser || canSeeAdmin(role)

  /** Tracks whether the user explicitly closed the sidebar via the toggle button.
   * When true, hover-to-expand is disabled until the button reopens it. */
  const [userClosed, setUserClosed] = useState(false)
  /** Tracks hover-to-open state. Triggered only by hovering the sidebar rail,
   * NOT the toggle button or its surrounding buffer. */
  const [isHoverOpen, setIsHoverOpen] = useState(false)
  /** Debounce timer for hover-to-open so quick passes don't flash the sidebar open. */
  const hoverTimerRef = useRef<number | null>(null)

  // Reset user-closed and hover-open flags when the button reopens the sidebar
  useEffect(() => {
    if (isOpen) {
      setUserClosed(false)
      setIsHoverOpen(false)
    }
  }, [isOpen])

  const handleToggle = () => {
    setUserClosed(!isOpen)
    setIsHoverOpen(false)
    onToggle()
  }

  /** Hover-to-open: only the sidebar rail triggers this. The toggle button wrapper
   * has its own handlers that cancel any pending open timer. */
  const handleSidebarMouseEnter = () => {
    if (userClosed) return
    hoverTimerRef.current = window.setTimeout(() => setIsHoverOpen(true), 100)
  }

  const handleSidebarMouseLeave = () => {
    if (hoverTimerRef.current) {
      window.clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
    setIsHoverOpen(false)
  }

  /** Toggle button buffer: hovering here must NOT open the sidebar.
   * Cancels any pending hover-open timer so the sidebar stays closed. */
  const handleToggleBufferMouseEnter = () => {
    if (hoverTimerRef.current) {
      window.clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
    setIsHoverOpen(false)
  }

  const handleToggleBufferMouseLeave = () => {
    // Intentionally empty: the toggle button is click-only, never hover-open.
  }

  const activeOrders = (currentAccount?.orders || []).filter((o) => o.tab === 'Active').length
  const newSellerReqs = (currentAccount?.sellerReq || []).filter((r) => r.state === 'new').length
  const openFlags = db.flags.filter((f) => f.state === 'open').length
  const openForumReports = db.freports.filter((r) => r.status === FR_STATUS.pending).length
  const baoWaitingCount = db.txn
    .filter(baoIsOfficialTxn)
    .filter((t) => baoStatusOf(t) === 'Request Received').length
  const baoLowCount = baoLowUnits(db.official).length

  const badgeFor = (path: string): number => {
    if (path === 'orders') return activeOrders
    if (path === 'shop') return newSellerReqs
    if (path === 'moderation') return openFlags
    if (path === 'baoorders') return baoWaitingCount
    if (path === 'baostock') return baoLowCount
    if (path === 'forum-reports') return openForumReports
    return 0
  }

  /** Track which sections are collapsed (accordion state). */
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())

  const isSectionCollapsed = (section: string) => collapsedSections.has(section)
  const toggleSection = (section: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev)
      if (next.has(section)) next.delete(section)
      else next.add(section)
      return next
    })
  }

  return (
    <>
      <div
        className={`scrim ${open ? 'show' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      >
        {open && (
          <span className="sr-only" aria-live="polite">
            Navigation drawer open. Press Escape or click outside to close.
          </span>
        )}
      </div>
      <aside
        className={`side ${isOpen ? '' : 'collapsed'} ${!isOpen && userClosed ? 'user-closed' : ''} ${isHoverOpen ? 'hover-open' : ''} ${open ? 'open' : ''}`}
        aria-label="Main"
        onMouseEnter={handleSidebarMouseEnter}
        onMouseLeave={handleSidebarMouseLeave}
      >
        {/* Toggle button + surrounding buffer zone.
           Rendered as a sibling of .sidebar-inner (NOT inside the hover target)
           so hovering the button never triggers hover-to-open. */}
        <div
          className="toggle-wrapper"
          onMouseEnter={handleToggleBufferMouseEnter}
          onMouseLeave={handleToggleBufferMouseLeave}
        >
          <button
            type="button"
            className="sidebar-toggle"
            aria-expanded={isOpen}
            aria-label="Toggle navigation sidebar"
            title={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            onClick={handleToggle}
          >
            <span className={`toggle-arrow ${(isOpen || isHoverOpen) ? '' : 'rotate'}`} aria-hidden="true" />
          </button>
        </div>

        <div className="sidebar-inner">
          {/* .sidebar-scroll gives the yellow/gold scrollbar on hover */}
          <div className="sidebar-scroll">
            {NAV_SECTIONS.filter((s) => s !== 'ADMIN' || showAdmin).map((section, i, arr) => (
              <div key={section} className="side-group">
                <button
                  type="button"
                  className={`sect ${isSectionCollapsed(section) ? 'collapsed' : ''}`}
                  aria-expanded={!isSectionCollapsed(section)}
                  aria-controls={`section-${section}`}
                  onClick={() => toggleSection(section)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      toggleSection(section)
                    }
                  }}
                >
                  {section}
                  <Icon name="chev" size="sm" className="sect-chev" aria-hidden="true" />
                </button>
                <div
                  id={`section-${section}`}
                  className={`section-content ${isSectionCollapsed(section) ? 'collapsed-section' : ''}`}
                >
                  {APP_PAGES.filter((p) => p.section === section).map((p) => {
                    const badge = badgeFor(p.path)
                    const isOn = normalizedActive === p.path
                    return (
                      <Link
                        key={p.path}
                        to={p.path}
                        className={`nav ${isOn ? 'on' : ''}`}
                        aria-current={isOn ? 'page' : undefined}
                        aria-label={p.title}
                        onClick={() => {
                          if (p.path === 'browse') {
                            clearBrowseFilters()
                          }
                          onClose()
                        }}
                      >
                        <Icon name={p.icon} aria-hidden="true" />
                        <span>{showAdmin && p.path === 'create' ? 'Admin | Sell an Item' : showAdmin && p.path === 'shop' ? 'Admin | RTU Shop' : p.title}</span>
                        {badge > 0 && <span className="badge" aria-label={`${badge} notifications`}>{badge}</span>}
                      </Link>
                    )
                  })}
                </div>
                {i < arr.length - 1 && <hr className="nav-divider" aria-hidden="true" />}
              </div>
            ))}

            <div className="campus">
              <b>Pasig Campus only</b>
              <span>Meetups happen on campus. RTU Tindahan does not provide delivery or logistics.</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
