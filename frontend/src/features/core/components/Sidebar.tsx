import { Icon } from '@/common/components/Icon'
import { Logo } from '@/common/components/Logo'
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
  onClose: () => void
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
 */
export function Sidebar({ activePath, role, open, onClose }: SidebarProps) {
  const { db, currentAccount, isStaffUser, clearBrowseFilters } = useTindahan()

  const normalizedActive = PATH_ALIASES[activePath] || activePath
  const showAdmin = isStaffUser || canSeeAdmin(role)

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

  return (
    <>
      <div className={`scrim ${open ? 'show' : ''}`} onClick={onClose} aria-hidden="true" />
      <aside className={`side ${open ? 'open' : ''}`} aria-label="Main">
        <Logo />

        {NAV_SECTIONS.filter((s) => s !== 'ADMIN' || showAdmin).map((section) => (
          <div key={section} className="side-group">
            <div className="sect">{section}</div>
            {APP_PAGES.filter((p) => p.section === section).map((p) => {
              const badge = badgeFor(p.path)
              const isOn = normalizedActive === p.path
              return (
                <Link
                  key={p.path}
                  to={p.path}
                  className={`nav ${isOn ? 'on' : ''}`}
                  aria-current={isOn ? 'page' : undefined}
                  onClick={() => {
                    if (p.path === 'browse') {
                      clearBrowseFilters()
                    }
                    onClose()
                  }}
                >
                  <Icon name={p.icon} />
                  <span>{showAdmin && p.path === 'create' ? 'Admin | Sell an Item' : showAdmin && p.path === 'shop' ? 'Admin | RTU Shop' : p.title}</span>
                  {badge > 0 && <span className="badge">{badge}</span>}
                </Link>
              )
            })}
          </div>
        ))}

        <div className="campus">
          <b>Pasig Campus only</b>
          Meetups happen on campus. RTU Tindahan does not provide delivery or logistics.
        </div>
      </aside>
    </>
  )
}
