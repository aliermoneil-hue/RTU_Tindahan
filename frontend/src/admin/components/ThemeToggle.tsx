import type { ReactNode } from 'react'
import { setTheme, useTheme } from '../lib/theme'
import type { ThemeChoice } from '../lib/theme'

const OPTIONS: { value: ThemeChoice; label: string; icon: ReactNode }[] = [
  {
    value: 'light',
    label: 'Light',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    ),
  },
  {
    value: 'system',
    label: 'Auto',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <path d="M8 20h8M12 16v4" />
      </svg>
    ),
  },
  {
    value: 'dark',
    label: 'Dark',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
      </svg>
    ),
  },
]

/** Light, Auto (follow the system), and Dark. The choice is remembered in this browser. */
export function ThemeToggle() {
  const theme = useTheme()
  const index = OPTIONS.findIndex((option) => option.value === theme)

  return (
    <div className="theme-toggle" role="radiogroup" aria-label="Color theme">
      <span className="theme-thumb" aria-hidden="true" style={{ transform: `translateX(${index * 100}%)` }} />
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={theme === option.value}
          className="theme-option"
          title={option.value === 'system' ? 'Follow the system setting' : `${option.label} theme`}
          onClick={() => setTheme(option.value)}
        >
          {option.icon}
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  )
}
