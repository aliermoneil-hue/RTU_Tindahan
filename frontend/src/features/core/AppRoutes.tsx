import { useEffect } from 'react'
import { navigate, useRoute } from '@/common/router/router'
import { LoginPage, useAuth } from '@/features/auth'
import { AppLayout } from './layouts/AppLayout'
import { PublicLayout } from './layouts/PublicLayout'
import { LandingPage } from './pages/LandingPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { findPage } from './routes'

/**
 * ROUTES: decides which page to show.
 *  - Visitors (not signed in): landing page, login, register.
 *  - Signed-in users: every page in APP_PAGES, inside the sidebar layout.
 *  - Wrong combination: redirect (visitor opens a member page -> login).
 * To swap a placeholder for a real page, change the `page` line below.
 */
export function AppRoutes() {
  const { path } = useRoute()
  const { user, isLoading } = useAuth()

  const isPublicPath = path === '' || path === 'login' || path === 'register'
  const redirectTo = !isLoading && (user ? (path === 'login' || path === 'register' ? 'marketplace' : null) : !isPublicPath ? 'login' : null)

  useEffect(() => {
    if (redirectTo) navigate(redirectTo, { replace: true })
  }, [redirectTo])

  if (isLoading || redirectTo) {
    return <p style={{ padding: 40, textAlign: 'center' }} className="muted">Loading...</p>
  }

  // ----- signed-in -----
  if (user) {
    const active = path === '' ? 'marketplace' : path
    const info = findPage(active)
    return (
      <AppLayout user={user} activePath={active}>
        {info ? <PlaceholderPage page={info} /> : <NotFoundPage />}
      </AppLayout>
    )
  }

  // ----- visitor -----
  if (path === 'login') {
    return (
      <PublicLayout>
        <LoginPage />
      </PublicLayout>
    )
  }
  if (path === 'register') {
    return (
      <PublicLayout>
        <div className="g-wrap" style={{ padding: '48px 0' }}>
          <PlaceholderPage
            page={{
              path: 'register',
              title: 'Create account',
              icon: 'key',
              about: 'The sign-up form with RTU email verification.',
              backend: 'available',
            }}
          />
        </div>
      </PublicLayout>
    )
  }
  return (
    <PublicLayout>
      <LandingPage />
    </PublicLayout>
  )
}
