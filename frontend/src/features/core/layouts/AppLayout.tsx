import { useState, type ReactNode } from 'react'
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
 *   [ Sidebar ] [ Topbar          ]
 *               [ page content    ]
 *               [ footer          ]
 * Page components only provide the content; this layout adds everything else.
 */
export function AppLayout({ user, activePath, children }: AppLayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="app">
      <Sidebar
        activePath={activePath}
        role={user.role}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
      <div className="main">
        <Topbar user={user} onMenuClick={() => setDrawerOpen(true)} />
        <main className="page">{children}</main>
        <SiteFooter variant="member" />
      </div>
      <GlobalOverlays />
    </div>
  )
}
