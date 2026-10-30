import { useState, useCallback, useEffect, useRef } from 'react'
import logoImg from '@/assets/rtu-tindahan-logo.png'
import { navigate } from '@/common/router/router'
import './PubTop.css'

export type PubTopSection = 'about' | 'insights' | 'help'

interface PubTopProps {
onSection?: (section: PubTopSection) => void
onNavigate?: (route: string) => void
}

export function PubTop({ onSection, onNavigate }: PubTopProps = {}) {
// null = no tab highlighted (at top / hero / after clicking logo)
const [activeSection, setActiveSection] = useState<PubTopSection | null>(null)
// Prevents scroll spy from clearing the highlight right after a programmatic scroll
const isProgrammatic = useRef(false)

// Scroll spy: highlight the tab whose section is nearest the top of the viewport.
// When back at the hero (top of page), clear the highlight.
useEffect(() => {
    const handleScroll = () => {
    if (isProgrammatic.current) return

    const sections: { id: PubTopSection; elementId: string }[] = [
        { id: 'about', elementId: 'about' },
        { id: 'insights', elementId: 'insights' },
        { id: 'help', elementId: 'help' },
    ]
    let current: PubTopSection | undefined

    for (const { id, elementId } of sections) {
        const el = document.getElementById(elementId)
        if (el && el.getBoundingClientRect().top <= 120) {
        current = id
        }
    }

    setActiveSection(current ?? null)
    }

    handleScroll() // check on mount
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
}, [])

// Logo: scroll smoothly to top and clear the highlight
const handleLogo = useCallback(() => {
    isProgrammatic.current = true
    onNavigate?.('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setActiveSection(null)
    setTimeout(() => (isProgrammatic.current = false), 800)
}, [onNavigate])

// Auth buttons: go to their proper pages
const handleAuth = useCallback((route: string) => {
    onNavigate?.(route)
    navigate(route)
}, [onNavigate])

// Nav tabs: highlight clicked tab and scroll to its section
const handleSection = useCallback((section: PubTopSection) => {
    isProgrammatic.current = true
    onSection?.(section)
    setActiveSection(section)
    const el = document.getElementById(section)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setTimeout(() => (isProgrammatic.current = false), 800)
}, [onSection])

return (
    <header className="pub-top">
    <button
        type="button"
        className="logo"
        onClick={handleLogo}
        aria-label="RTU Tindahan home"
    >
        <img className="logo-img" src={logoImg} alt="RTU Tindahan Campus Marketplace" />
    </button>

    <nav className="pub-top-nav" aria-label="Sections">
        <button
        type="button"
        className={`nav-tab${activeSection === 'about' ? ' on' : ''}`}
        data-act="gnav"
        data-s="about"
        aria-current={activeSection === 'about' ? 'location' : undefined}
        onClick={() => handleSection('about')}
        >
        About Us
        </button>
        <button
        type="button"
        className={`nav-tab${activeSection === 'insights' ? ' on' : ''}`}
        data-act="gnav"
        data-s="insights"
        aria-current={activeSection === 'insights' ? 'location' : undefined}
        onClick={() => handleSection('insights')}
        >
        Insights
        </button>
        <button
        type="button"
        className={`nav-tab${activeSection === 'help' ? ' on' : ''}`}
        data-act="gnav"
        data-s="help"
        aria-current={activeSection === 'help' ? 'location' : undefined}
        onClick={() => handleSection('help')}
        >
        Need Help?
        </button>
    </nav>

    <span className="pub-top-spacer" />

    <div className="pub-top-actions">
        <button
        type="button"
        className="btn ghost sm"
        onClick={() => handleAuth('login')}
        >
        Sign in
        </button>
        <button
        type="button"
        className="btn sm"
        onClick={() => handleAuth('register')}
        >
        Create account
        </button>
    </div>
    </header>
    )
}