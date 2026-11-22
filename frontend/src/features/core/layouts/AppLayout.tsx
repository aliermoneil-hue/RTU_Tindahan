import { useState, useEffect, type ReactNode } from 'react'
import type { User } from '@/common/types'
import { GlobalOverlays } from '@/features/marketplace/components/GlobalOverlays'
import { Sidebar } from '../components/Sidebar'
import { Topbar } from '../components/Topbar'
import { SiteFooter } from '../components/SiteFooter'
import './AppLayout.css'

interface AppLayoutProps {
  user: User
  activePath: string
  children: ReactNode
}

/**
 * LAYOUT for signed-in pages:
 *   [ Topbar (full width, fixed)         ]
 *   [ Sidebar (fixed, collapsible) ] [ page content ]
 *               [ footer under page only ]
 * Page components only provide the content; this layout adds everything else.
 *
 * The exact height of the fixed topbar + scalloped awning is measured via
 * ResizeObserver and exposed as --header-offset so the sidebar and <main>
   can position themselves precisely below it without any overlap or guesswork.
 */
export function AppLayout({ user, activePath, children }: AppLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  )

  // Re-evaluate default open/closed state when the viewport crosses 768px.
  // Close the mobile drawer when resizing to desktop (>= 768px).
  useEffect(() => {
    const onResize = () => {
      const wasMobile = window.innerWidth < 768
      setIsSidebarOpen(window.innerWidth >= 768)
      if (!wasMobile && window.innerWidth >= 768 && isMobileMenuOpen) {
        setIsMobileMenuOpen(false)
      }
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [isMobileMenuOpen])

  // Measure the fixed topbar+awning height (--header-offset) AND navbar-only height (--navbar-height).
  // --header-offset stays untouched for desktop and <main>. --navbar-height is mobile-only.
  useEffect(() => {
    if (typeof window === 'undefined' || !ResizeObserver) return

    const setOffset = () => {
      const el = document.querySelector('.top')
      if (!el) return

      const rect = el.getBoundingClientRect()
      // --navbar-height: just the navy bar content height (mobile drawer anchors here)
      document.documentElement.style.setProperty(
        '--navbar-height',
        `${Math.ceil(rect.height)}px`
      )
      // --header-offset: navbar + scalloped awning strip (+10px). Untouched for desktop/<main>.
      document.documentElement.style.setProperty(
        '--header-offset',
        `${Math.ceil(rect.height) + 10}px`
      )
    }

    setOffset()
    const ro = new ResizeObserver(() => setOffset())
    ro.observe(document.documentElement)
    window.addEventListener('resize', setOffset)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', setOffset)
    }
  }, [])

  // Mobile drawer (< 900px): lock background scroll and close on Escape
  useEffect(() => {
    const isMobile = window.innerWidth < 900
    if (!isMobileMenuOpen || !isMobile) return

    // Save scroll position so the page doesn't jump when we lock it
    const scrollY = window.scrollY

    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.left = '0'
    document.body.style.width = '100%'
    document.documentElement.style.overflow = 'hidden'
    document.documentElement.style.touchAction = 'none'
    document.body.style.touchAction = 'none'

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMobileMenuOpen(false)
    }

    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.removeProperty('overflow')
      document.body.style.removeProperty('position')
      document.body.style.removeProperty('top')
      document.body.style.removeProperty('left')
      document.body.style.removeProperty('width')
      document.documentElement.style.removeProperty('overflow')
      document.documentElement.style.removeProperty('touchAction')
      document.body.style.removeProperty('touchAction')
      window.scrollTo(0, scrollY)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isMobileMenuOpen])
  return (
    <div className={`app ${isSidebarOpen ? 'sidebar-open' : ''} ${isMobileMenuOpen ? 'mobile-drawer-open' : ''}`}>
      <Topbar
        user={user}
        onMenuClick={() => setIsMobileMenuOpen((prev) => !prev)}
      />
      {/* Mobile-only click-outside backdrop — renders only when drawer is open (< 768px) */}
      {isMobileMenuOpen && (
        <div
          className="mobile-backdrop"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}
      <div className="main">
        <Sidebar
          activePath={activePath}
          role={user.role}
          open={isMobileMenuOpen}
          isOpen={isSidebarOpen}
          onClose={() => setIsMobileMenuOpen(false)}
          onToggle={() => setIsSidebarOpen((prev) => !prev)}
        />
        <div className="page-wrap">
          <main className="page">
            <div className="page-content-shell">{children}</div>
          </main>
          <SiteFooter variant="member" />
        </div>
      </div>
      <GlobalOverlays />
    </div>
  )
}
