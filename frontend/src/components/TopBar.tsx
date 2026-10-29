import './TopBar.css'
import logo from '../assets/logo.png'
import Icon from './Icon'
import { authHref } from '../config'

export const NAV = [
  { id: 'about', label: 'About Us' },
  { id: 'insights', label: 'Insights' },
  { id: 'help', label: 'Need Help?' },
]

type Props = {
  active: string | null
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  onSection: (id: string) => void
  onLogo: () => void
}

/* The top bar: logo, three section tabs, theme switch, Sign in and Create account. */
export default function TopBar({ active, theme, onToggleTheme, onSection, onLogo }: Props) {
  return (
    <header className="topbar">
      <a
        className="topbar-logo"
        href="#/"
        aria-label="RTU Tindahan home"
        onClick={(e) => {
          e.preventDefault()
          onLogo()
        }}
      >
        <img src={logo} alt="RTU Tindahan Campus Marketplace" />
      </a>
      <nav aria-label="Sections">
        {NAV.map((n) => (
          <button key={n.id} type="button" className={active === n.id ? 'on' : ''} onClick={() => onSection(n.id)}>
            {n.label}
          </button>
        ))}
      </nav>
      <span className="topbar-grow" />
      <button
        type="button"
        className="topbar-theme"
        onClick={onToggleTheme}
        aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
      >
        <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
      </button>
      <a className="btn ghost sm" href={authHref('sign-in')}>
        Sign in
      </a>
      <a className="btn yellow sm" href={authHref('create-account')}>
        Create account
      </a>
    </header>
  )
}
