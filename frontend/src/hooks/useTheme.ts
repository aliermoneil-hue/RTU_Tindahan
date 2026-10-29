import { useCallback, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'
const KEY = 'rtu_theme'

function load(): Theme {
  try {
    return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

/* Light or dark, remembered in this browser. Sets data-theme on the html element. */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(load)
  useEffect(() => {
    if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark')
    else document.documentElement.removeAttribute('data-theme')
    try {
      localStorage.setItem(KEY, theme)
    } catch {
      /* storage can be blocked, the theme still works for this visit */
    }
  }, [theme])
  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), [])
  return [theme, toggle]
}
