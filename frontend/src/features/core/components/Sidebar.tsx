import { Icon } from '@/common/components/Icon'
import { Logo } from '@/common/components/Logo'
import { Link } from '@/common/router/router'
import type { Role } from '@/common/types'
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

/**
 * NAVY SIDEBAR for signed-in pages. Menu items come from APP_PAGES (routes.ts).
 * On small screens it becomes a drawer opened by the hamburger button.
 */
export function Sidebar({ activePath, role, open, onClose }: SidebarProps) {
  return (
    <>
      <div className={`scrim ${open ? 'show' : ''}`} onClick={onClose} aria-hidden="true" />
      <aside className={`side ${open ? 'open' : ''}`} aria-label="Main">
        <Logo />

        {NAV_SECTIONS.filter((s) => s !== 'ADMIN' || canSeeAdmin(role)).map((section) => (
          <div key={section} className="side-group">
            <div className="sect">{section}</div>
            {APP_PAGES.filter((p) => p.section === section).map((p) => (
              <Link
                key={p.path}
                to={p.path}
                className={`nav ${activePath === p.path ? 'on' : ''}`}
                aria-current={activePath === p.path ? 'page' : undefined}
                onClick={onClose}
              >
                <Icon name={p.icon} />
                <span>{p.title}</span>
              </Link>
            ))}
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
