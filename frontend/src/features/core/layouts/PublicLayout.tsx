import type { ReactNode } from 'react'
import { PubTop } from '../components/PubTop'
import { SiteFooter } from '../components/SiteFooter'

/** Layout for visitors: navy top bar + page content + footer. */
export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PubTop />
      <main style={{ flex: 1 }}>{children}</main>
      <SiteFooter variant="guest" />
    </div>
  )
}
