import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { scrollToTop } from '../lib/motion'

type Direction = 'forward' | 'back' | 'none'

/** Slides the new screen in from the side it sits on in the menu, and scrolls back to the top. */
export function PageTransition({
  routeKey,
  order,
  children,
}: {
  routeKey: string
  order: number
  children: ReactNode
}) {
  // The direction is worked out once per screen, so later re-renders never restart the animation.
  const seen = useRef<{ key: string; order: number; direction: Direction }>({
    key: routeKey,
    order,
    direction: 'none',
  })
  if (seen.current.key !== routeKey) {
    const before = seen.current.order
    seen.current = {
      key: routeKey,
      order,
      direction: order > before ? 'forward' : order < before ? 'back' : 'none',
    }
  }

  useEffect(() => {
    scrollToTop()
  }, [routeKey])

  return (
    <div key={routeKey} className={`page page-${seen.current.direction}`}>
      {children}
    </div>
  )
}
