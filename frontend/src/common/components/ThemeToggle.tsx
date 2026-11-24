import { useCallback, useEffect, useRef, useState } from 'react'
import { useTheme } from '@/common/hooks/useTheme'
import { Icon } from '@/common/components/Icon'
import './ThemeToggle.css'

/** Crisp 16px monitor SVG used for the System appearance option. */
const MONITOR_SVG = (
  <svg
    viewBox="0 0 24 24"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x={2} y={7} width={20} height={12} rx={1} />
    <path d="M12 19v3" />
    <path d="M10 22h4" />
  </svg>
)

type ThemeOptId = 'system' | 'light' | 'dark'

const OPTIONS: { id: ThemeOptId; title: string; subtitle: string }[] = [
  { id: 'system', title: 'System', subtitle: 'Follows your device' },
  { id: 'light', title: 'Light', subtitle: 'Bright campus view' },
  { id: 'dark', title: 'Dark', subtitle: 'Low-light comfort' },
]

/**
 * THEME TOGGLE — Appearance popover
 * Trigger button shows the current preference icon; clicking opens a popover
 * with System / Light / Dark options. Closes on selection, outside click, or Escape.
 */
export function ThemeToggle() {
  const { preference, theme, setPreference } = useTheme()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const toggleOpen = useCallback(() => setOpen((prev) => !prev), [])

  const select = useCallback(
    (id: ThemeOptId) => {
      setPreference(id)
      setOpen(false)
    },
    [setPreference]
  )

  // Click outside to close
  useEffect(() => {
    const onMousedown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    window.addEventListener('mousedown', onMousedown)
    return () => window.removeEventListener('mousedown', onMousedown)
  }, [])

  // Escape to close
  useEffect(() => {
    const onKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeydown)
    return () => window.removeEventListener('keydown', onKeydown)
  }, [])

  const isSystem = preference === 'system'
  const triggerIcon = isSystem ? MONITOR_SVG : (
    <Icon name={preference === 'light' ? 'sun' : 'moon'} size="sm" />
  )

  const statusText = preference === 'system'
    ? `Auto · ${theme === 'dark' ? 'Dark' : 'Light'}`
    : theme === 'dark'
      ? 'Dark'
      : 'Light'

  return (
    <div className="theme-menu-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`theme-toggle${open ? ' open' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={
          preference === 'system'
            ? 'Theme: System (click to switch)'
            : preference === 'light'
              ? 'Theme: Light (click to switch)'
              : 'Theme: Dark (click to switch)'
        }
        title={isSystem ? 'System' : preference === 'light' ? 'Light' : 'Dark'}
        onClick={toggleOpen}
      >
        {triggerIcon}
      </button>

      {open && (
        <div className="theme-popover" role="menu" aria-label="Appearance">
          <div className="theme-popover-head">
            <span className="theme-popover-label">APPEARANCE</span>
            <span className="theme-popover-status">{statusText}</span>
          </div>
          {OPTIONS.map((opt) => {
            const active = preference === opt.id
            return (
              <button
                key={opt.id}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                className={`theme-opt${active ? ' active' : ''}`}
                onClick={() => select(opt.id)}
              >
                <span className="theme-opt-ico" aria-hidden="true">
                  {opt.id === 'system' ? MONITOR_SVG : opt.id === 'light' ? (
                    <Icon name="sun" size="sm" />
                  ) : (
                    <Icon name="moon" size="sm" />
                  )}
                </span>
                <span className="theme-opt-copy">
                  <strong>{opt.title}</strong>
                  <span>{opt.subtitle}</span>
                </span>
                <span className="theme-opt-check" aria-hidden="true">
                  {active ? <Icon name="check" size="sm" /> : null}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
