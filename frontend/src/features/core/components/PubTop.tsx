import { useState, useCallback, useEffect, useRef } from 'react'
import logoImg from '@/assets/logo-removebg-preview.png'
import { navigate, useRoute } from '@/common/router/router'
import { ThemeToggle } from '@/common/components/ThemeToggle'
import './PubTop.css'

export type PubTopSection = 'about' | 'insights' | 'help'

interface PubTopProps {
onSection?: (section: PubTopSection) => void
onNavigate?: (route: string) => void
}

export function PubTop({ onSection, onNavigate }: PubTopProps = {}) {
const { path } = useRoute()
// null = no tab highlighted (at top / hero / after clicking logo)
const [activeSection, setActiveSection] = useState<PubTopSection | null>(null)
const [dropdownOpen, setDropdownOpen] = useState(false)
const [isMobile, setIsMobile] = useState(window.innerWidth <= 900)
const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
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

// Track mobile viewport (matches the max-width: 900px breakpoint in PubTop.css)
useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 900)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
}, [])

// Scroll to a section stored in sessionStorage after navigating to the landing page
// from a non-landing page (e.g. student-sellers or store guest pages).
useEffect(() => {
    const isLanding = path === '' || path === 'landing'
    if (!isLanding) return

    const target = sessionStorage.getItem('rtu:scroll-to-section')
    if (!target) return

    sessionStorage.removeItem('rtu:scroll-to-section')

    const timer = setTimeout(() => {
    isProgrammatic.current = true
    setActiveSection(target as PubTopSection)
    const el = document.getElementById(target)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setTimeout(() => (isProgrammatic.current = false), 800)
    }, 100)

    return () => clearTimeout(timer)
}, [path])

// Close the About Us dropdown when clicking outside the nav
useEffect(() => {
    if (!dropdownOpen) return
    const onDocClick = (e: MouseEvent) => {
    const target = e.target as Node
    const nav = document.querySelector('.pub-top nav')
    if (nav && !nav.contains(target)) {
        setDropdownOpen(false)
    }
    }
    window.addEventListener('click', onDocClick)
    return () => window.removeEventListener('click', onDocClick)
}, [dropdownOpen])

// Close mobile menu when clicking outside
useEffect(() => {
    if (!mobileMenuOpen) return
    const onDocClick = (e: MouseEvent) => {
    const target = e.target as Node
    const btn = document.querySelector('.mobile-menu-btn')
    const panel = document.querySelector('.mobile-menu-panel')
    if (btn && !btn.contains(target) && panel && !panel.contains(target)) {
        setMobileMenuOpen(false)
    }
    }
    window.addEventListener('click', onDocClick)
    return () => window.removeEventListener('click', onDocClick)
}, [mobileMenuOpen])

// Logo: scroll smoothly to top and clear the highlight
const handleLogo = useCallback(() => {
    isProgrammatic.current = true
    // Set the hash directly (useRoute picks it up via hashchange) so the
    // router's instant scroll doesn't override the smooth scroll below.
    window.location.hash = '#/'
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setActiveSection(null)
    setTimeout(() => (isProgrammatic.current = false), 800)
}, [])

// Auth buttons: go to their proper pages.
// On mobile, flag the next page to scroll down after 3 seconds (the timer
// can't live in PubTop because this component unmounts on navigation).
const handleAuth = useCallback((route: string) => {
    onNavigate?.(route)

    if (isMobile && (route === 'login' || route === 'register')) {
        sessionStorage.setItem('rtu:scroll-after-login', 'true')
    }

    navigate(route)
}, [isMobile, onNavigate])

// Nav tabs: highlight clicked tab and scroll to its section.
// If not on the landing page, navigate there first and store the target
// section in sessionStorage so the landing page can scroll to it on mount.
const handleSection = useCallback((section: PubTopSection) => {
    const isLanding = path === '' || path === 'landing'
    if (!isLanding) {
    sessionStorage.setItem('rtu:scroll-to-section', section)
    navigate('')
    setDropdownOpen(false)
    return
    }
    isProgrammatic.current = true
    onSection?.(section)
    setActiveSection(section)
    const el = document.getElementById(section)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setTimeout(() => (isProgrammatic.current = false), 800)
}, [path, onSection, navigate])

// Only show the About Us dropdown as active when on the landing page and a section is open.
// This prevents stale state from showing it as active on Student Sellers / Official RTU Store.
const isLanding = path === '' || path === 'landing'
const isDropdownActive =
    isLanding && (activeSection === 'about' || activeSection === 'insights' || activeSection === 'help')

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
        {/* About Us dropdown: contains About Us (trigger), Insights, Need Help */}
        <div className="nav-dropdown" onClick={(e) => e.stopPropagation()}>
        <button
            type="button"
            className={`nav-tab${isDropdownActive ? ' on' : ''} dropdown-trigger`}
            data-act="gnav"
            data-s="about"
            aria-current={isDropdownActive ? 'location' : undefined}
            aria-haspopup="true"
            aria-expanded={dropdownOpen}
            onClick={() => setDropdownOpen(!dropdownOpen)}
        >
            About Us<span className="dropdown-arrow"></span>
        </button>
        {dropdownOpen && (
            <div className="nav-dropdown-menu" role="menu">
            <button
                type="button"
                className="nav-dropdown-item"
                role="menuitem"
                onClick={() => {
                setDropdownOpen(false)
                handleSection('about')
                }}
            >
                About Us
            </button>
            <button
                type="button"
                className="nav-dropdown-item"
                role="menuitem"
                onClick={() => {
                setDropdownOpen(false)
                handleSection('insights')
                }}
            >
                Insights
            </button>
            <button
                type="button"
                className="nav-dropdown-item"
                role="menuitem"
                onClick={() => {
                setDropdownOpen(false)
                handleSection('help')
                }}
            >
                Need Help?
            </button>
            </div>
        )}
        </div>

        {/* Guest-facing marketplace buttons */}
        <button
        type="button"
        className={`nav-tab${path === 'student-sellers' ? ' on' : ''}`}
        aria-current={path === 'student-sellers' ? 'location' : undefined}
        onClick={() => {
        setDropdownOpen(false)
        navigate('student-sellers')
        }}
        >
        Student Sellers
        </button>
        <button
        type="button"
        className={`nav-tab${path === 'store' ? ' on' : ''}`}
        aria-current={path === 'store' ? 'location' : undefined}
        onClick={() => {
        setDropdownOpen(false)
        navigate('store')
        }}
        >
        Official RTU Store
        </button>
    </nav>

    <span className="pub-top-spacer" />

    <div className="pub-top-actions">
        <ThemeToggle />
        {isMobile && (
        <button
            type="button"
            className="mobile-menu-btn"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
            ☰ Menu
        </button>
        )}
        {!isMobile && (
        <>
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
        </>
        )}
    </div>

    {isMobile && mobileMenuOpen && (
        <div className="mobile-menu-panel">
        <button
            type="button"
            className="mobile-menu-item"
            onClick={() => {
            setMobileMenuOpen(false)
            handleSection('about')
            }}
        >
            About Us
        </button>
        <button
            type="button"
            className="mobile-menu-item"
            onClick={() => {
            setMobileMenuOpen(false)
            handleSection('insights')
            }}
        >
            Insights
        </button>
        <button
            type="button"
            className="mobile-menu-item"
            onClick={() => {
            setMobileMenuOpen(false)
            handleSection('help')
            }}
        >
            Need Help?
        </button>
        <button
            type="button"
            className="mobile-menu-item"
            onClick={() => {
            setMobileMenuOpen(false)
            navigate('student-sellers')
            }}
        >
            Student Sellers
        </button>
        <button
            type="button"
            className="mobile-menu-item"
            onClick={() => {
            setMobileMenuOpen(false)
            navigate('store')
            }}
        >
            Official RTU Store
        </button>
        <div style={{ padding: '8px 16px', borderTop: '1px solid var(--line)', marginTop: 8, fontSize: 11, color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Account
        </div>
        <button
            type="button"
            className="mobile-menu-item"
            onClick={() => {
            setMobileMenuOpen(false)
            handleAuth('login')
            }}
        >
            Sign in
        </button>
        <button
            type="button"
            className="mobile-menu-item"
            onClick={() => {
            setMobileMenuOpen(false)
            handleAuth('register')
            }}
        >
            Create account
        </button>
        </div>
    )}
    </header>
    )
}