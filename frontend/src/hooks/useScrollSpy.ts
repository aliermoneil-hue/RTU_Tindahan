import { useEffect, useState } from 'react'

/* Returns the id of the section nearest the top of the window, so the matching menu tab can be highlighted. */
export function useScrollSpy(ids: string[], enabled: boolean): string | null {
  const [active, setActive] = useState<string | null>(null)
  useEffect(() => {
    if (!enabled) {
      setActive(null)
      return
    }
    let frame = 0
    const check = () => {
      frame = 0
      let found: string | null = null
      for (const id of ids) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top <= 140) found = id
      }
      setActive(found)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(check)
    }
    check()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [ids.join('|'), enabled])
  return active
}
