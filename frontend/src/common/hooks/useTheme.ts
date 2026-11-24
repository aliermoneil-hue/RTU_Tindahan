import { useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'
export type ThemePreference = 'system' | 'light' | 'dark'
const KEY = 'rtu_theme'
const THEME_SWITCHING_CLASS = 'theme-switching'

function resolveSystemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function readPreference(): ThemePreference {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw === 'system' || raw === 'light' || raw === 'dark') return raw
    return 'system'
  } catch {
    return 'system'
  }
}

function applyThemeColor(theme: Theme) {
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', theme === 'dark' ? '#121417' : '#0e2f5a')
  }
}

/**
 * Module-level store shared by every useTheme() instance.
 *
 * Root cause of the old flicker: each component had its own useState for
 * preference + theme, syncing only the resolved theme via a window event.
 * A second instance kept a stale preference (usually 'system'), resolved it
 * to the OS theme, called setTheme(osTheme), dispatched 'themechange', and
 * the first instance flipped back — ping-pong.
 *
 * Now there is ONE source of truth. getSnapshot() returns a stable object
 * reference (new object only when state actually changes), which is what
 * useSyncExternalStore requires to avoid infinite re-renders.
 */
let preference: ThemePreference = readPreference()
let systemDark = resolveSystemTheme() === 'dark'

function resolvedTheme(): Theme {
  return preference === 'system' ? (systemDark ? 'dark' : 'light') : preference
}

let snapshot: { preference: ThemePreference; theme: Theme } = {
  preference,
  theme: resolvedTheme(),
}

const listeners = new Set<(snap: { preference: ThemePreference; theme: Theme }) => void>()

function notify() {
  const snap = { preference, theme: resolvedTheme() }
  if (snap.theme !== snapshot.theme || snap.preference !== snapshot.preference) {
    snapshot = snap
  }
  for (const fn of listeners) {
    fn(snapshot)
  }
}

/** Apply the resolved theme to the DOM once. Freeze transitions for one frame. */
function apply() {
  const theme = resolvedTheme()

  document.documentElement.classList.add(THEME_SWITCHING_CLASS)
  requestAnimationFrame(() => {
    document.documentElement.classList.remove(THEME_SWITCHING_CLASS)
  })

  document.documentElement.setAttribute('data-theme', theme)
  applyThemeColor(theme)
}

/** Only place that writes localStorage. Never writes on load. */
function setPreference(next: ThemePreference) {
  if (next === preference) return
  preference = next
  try {
    localStorage.setItem(KEY, preference)
  } catch {
    /* private mode: just skip saving */
  }
  apply()
  notify()
}

/** toggle(): flip to the opposite of the current resolved theme.
   Never produces 'system' unless the user explicitly chooses it via setPreference(). */
function toggle() {
  const current = resolvedTheme()
  setPreference(current === 'dark' ? 'light' : 'dark')
}

function getSnapshot() {
  return snapshot
}

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
  }
}

/* ---- One-time init (runs once per page load, not per component) ---- */
let initialized = false
function ensureInit() {
  if (initialized) return
  initialized = true

  // matchMedia 'change': follows the OS live while preference === 'system',
  // and does NOT change the theme when preference is 'light' or 'dark'.
  const mql = window.matchMedia('(prefers-color-scheme: dark)')
  const onMediaChange = () => {
    const nextDark = mql.matches
    if (nextDark === systemDark) return
    systemDark = nextDark
    apply()
    notify()
  }
  mql.addEventListener('change', onMediaChange)

  // window 'storage': keeps other tabs in sync when 'rtu_theme' changes.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return
    const next = readPreference()
    if (next === preference) return
    preference = next
    apply()
    notify()
  }
  window.addEventListener('storage', onStorage)

  // Apply once at init (in case the inline index.html script hasn't run yet,
  // or to ensure the DOM matches the stored preference).
  apply()
  notify()
}

ensureInit()

/**
 * Light / dark mode with System, Light and Dark preferences.
 *
 * Public API (unchanged): { preference, theme, toggle, setPreference }
 *
 * All instances share one module-level store via useSyncExternalStore, so
 * toggling in one ThemeToggle instantly reflects in every other instance
 * (BrandLoader, second ThemeToggle, other tabs).
 */
export function useTheme() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  return {
    preference: snap.preference,
    theme: snap.theme,
    toggle,
    setPreference,
  }
}
