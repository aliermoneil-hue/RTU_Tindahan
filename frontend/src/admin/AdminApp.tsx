import { useEffect, useLayoutEffect } from 'react'
import type { ReactNode } from 'react'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { BackToTop } from './components/BackToTop'
import { Layout } from './components/Layout'
import { PageTransition } from './components/PageTransition'
import { navigate, useLocation } from './lib/router'
import { clearTheme, initTheme } from './lib/theme'
import { AccountsPage } from './pages/AccountsPage'
import { DashboardPage } from './pages/DashboardPage'
import { LoginPage, NoAccess } from './pages/LoginPage'
import { ROLE_LABEL } from './lib/types'
import './admin.css'

function Routes() {
  const { user, ready, abilities } = useAuth()
  const { path, search } = useLocation()

  // Signed-out visitors land on /login; signed-in users never see it.
  useEffect(() => {
    if (!ready) return
    if (!user && path !== '/login') navigate('/login', { replace: true })
    if (user && path === '/login') navigate('/', { replace: true })
  }, [ready, user, path])

  if (!ready) return <p className="boot muted">Loading…</p>
  if (!user) return <LoginPage />
  if (!abilities.dashboard) return <NoAccess roleLabel={ROLE_LABEL[user.role]} />

  let page: ReactNode
  if (path === '/accounts' && abilities.viewAccounts) page = <AccountsPage />
  else if (path === '/' || path === '/login') page = <DashboardPage />
  else
    page = (
      <>
        <h1>Page not found</h1>
        <p className="muted">That page does not exist, or your role cannot open it.</p>
      </>
    )

  // Where this screen sits in the menu decides which way it slides in.
  const queue = path === '/accounts' && search.get('verified') === 'false'
  const order = path === '/' ? 0 : path === '/accounts' ? (queue ? 2 : 1) : 3
  const routeKey = queue ? '/accounts?queue' : path

  return (
    <Layout>
      <PageTransition routeKey={routeKey} order={order}>
        {page}
      </PageTransition>
      <BackToTop />
    </Layout>
  )
}

export default function AdminApp() {
  // Apply the saved theme before the first paint, and leave the page clean on the way out.
  useLayoutEffect(() => {
    initTheme()
    return clearTheme
  }, [])

  return (
    <AuthProvider>
      <Routes />
    </AuthProvider>
  )
}
