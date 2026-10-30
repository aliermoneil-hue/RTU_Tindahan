import { useEffect, useState } from 'react'

/**
 * Tells which page section is currently at the top of the screen.
 * Used by the public navbar to highlight "About Us / Insights / Need Help?".
 * Returns the id of the section, or '' when none has been reached yet.
 */
export function useScrollSpy(ids: string[]): string {
  const [current, setCurrent] = useState('')
  const key = ids.join('|')

  useEffect(() => {
    let queued = false
    const check = () => {
      queued = false
      let found = ''
      for (const id of key.split('|')) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top <= 120) found = id
      }
      setCurrent(found)
    }
    const onScroll = () => {
      if (queued) return
      queued = true
      requestAnimationFrame(check)
    }
    check()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [key])

  return current
}
