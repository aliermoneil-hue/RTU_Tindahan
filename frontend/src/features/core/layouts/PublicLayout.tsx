import type { ReactNode } from 'react'
import { navigate, useRoute } from '@/common/router/router'
import { GlobalOverlays } from '@/features/marketplace/components/GlobalOverlays'
import { PubTop } from '../components/PubTop'
import { SiteFooter } from '../components/SiteFooter'
import './PublicLayout.css'

/** Layout for visitors: navy top bar + page content + footer. */
export function PublicLayout({ children }: { children: ReactNode }) {
  const { path } = useRoute()
  const isLanding = path === '' || path === 'landing'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <PubTop onNavigate={(route) => navigate(route)} />
      <main className={`public-main${isLanding ? ' is-landing' : ''}`}>
        {children}
      </main>
      <SiteFooter variant="guest" />
      <GlobalOverlays />
    </div>
  )
}
