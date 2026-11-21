import type { ReactNode } from 'react'
import { navigate } from '@/common/router/router'
import { PubTop } from '../components/PubTop'
import { SiteFooter } from '../components/SiteFooter'

/** Layout for visitors: navy top bar + page content + footer. */
export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <PubTop onNavigate={(route) => navigate(route)} />
      <main
        style={{
          flex: 1,
          minHeight: '100dvh',
          boxSizing: 'border-box',
          paddingBottom: '64px',
          backgroundColor: 'var(--bg, #f4f6fa)',
        }}
      >
        {children}
      </main>
      <SiteFooter variant="guest" />
    </div>
  )
}
