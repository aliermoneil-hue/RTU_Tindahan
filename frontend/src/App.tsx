import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import TopBar, { NAV } from './components/TopBar'
import Hero from './components/Hero'
import GuestBand from './components/GuestBand'
import About from './components/About'
import Insights from './components/Insights'
import Help from './components/Help'
import CtaBand from './components/CtaBand'
import Footer from './components/Footer'
import Modal from './components/Modal'
import GuestPage from './pages/GuestPage'
import AuthPage from './pages/AuthPage'
import VerifyHelpPage from './pages/VerifyHelpPage'
import { useHashRoute } from './hooks/useHashRoute'
import { useScrollSpy } from './hooks/useScrollSpy'
import { useTheme } from './hooks/useTheme'
import { GUIDELINES, POLICY } from './data'

const SECTION_IDS = NAV.map((n) => n.id)

function App() {
  const [path, go] = useHashRoute()
  const [theme, toggleTheme] = useTheme()
  const [modal, setModal] = useState<'guidelines' | 'policy' | null>(null)
  const pending = useRef<string | null>(null)
  const onHome = path === '/'
  const active = useScrollSpy(SECTION_IDS, onHome)

  /* Scroll to a section. From another page, go home first and scroll once the home page is drawn. */
  const goSection = useCallback(
    (id: string) => {
      if (path === '/') document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      else {
        pending.current = id
        go('/')
      }
    },
    [path, go],
  )

  useEffect(() => {
    if (onHome && pending.current) {
      const id = pending.current
      pending.current = null
      requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }))
    } else {
      window.scrollTo(0, 0)
    }
  }, [path, onHome])

  const logo = () => (onHome ? window.scrollTo({ top: 0, behavior: 'smooth' }) : go('/'))

  let body
  if (path === '/books') body = <GuestPage kind="books" />
  else if (path === '/merch') body = <GuestPage kind="merch" />
  else if (path === '/sign-in') body = <AuthPage mode="sign-in" />
  else if (path === '/create-account') body = <AuthPage mode="create-account" />
  else if (path === '/verify-help') body = <VerifyHelpPage />
  else
    body = (
      <main>
        <Hero />
        <GuestBand onOpen={setModal} />
        <About />
        <Insights />
        <Help onOpen={setModal} />
      </main>
    )

  return (
    <div className="app">
      <TopBar active={active} theme={theme} onToggleTheme={toggleTheme} onSection={goSection} onLogo={logo} />
      {body}
      <CtaBand />
      <Footer onSection={goSection} onOpen={setModal} />
      {modal === 'guidelines' && <Modal title="Community guidelines" items={GUIDELINES} onClose={() => setModal(null)} />}
      {modal === 'policy' && <Modal title="Prohibited items policy" items={POLICY} onClose={() => setModal(null)} />}
    </div>
  )
}

export default App
