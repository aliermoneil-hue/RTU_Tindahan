import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'
const KEY = 'rtu_theme'
const THEME_CHANGE_EVENT = 'rtu-theme-change'

function readTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

function applyThemeColor(theme: Theme) {
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', theme === 'dark' ? '#121212' : '#f2f5f9')
  }
}

/**
 * Light / dark mode. The choice is saved in the browser (not on the server).
 * index.html applies the saved theme before React loads so there is no flash.
 *
 * Multiple components can call useTheme() and they will all stay in sync:
 * toggling the theme dispatches a window 'rtu-theme-change' event that every
 * listener re-renders from, and <meta name="theme-color"> follows the active theme.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    applyThemeColor(theme)
    try {
      localStorage.setItem(KEY, theme)
    } catch {
      /* private mode: just skip saving */
    }
    // Broadcast the change so other useTheme() instances stay in sync
    window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: { theme } }))
  }, [theme])

  // Listen for theme changes dispatched from other components/tabs
  useEffect(() => {
    const onThemeChange = (e: CustomEvent) => {
      const next = (e.detail as { theme?: Theme })?.theme
      if (next && next !== theme) {
        setTheme(next)
      }
    }
    window.addEventListener(THEME_CHANGE_EVENT as unknown as string, onThemeChange as EventListener)
    return () => {
      window.removeEventListener(THEME_CHANGE_EVENT as unknown as string, onThemeChange as EventListener)
    }
  }, [theme])

  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), [])
  return { theme, toggle }
}
