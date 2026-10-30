import { navigate } from '@/common/router/router'

/**
 * Smooth-scrolls to a section of the landing page (id="about", "insights", "help").
 * If the visitor is on another page, go home first and then scroll.
 */
export function scrollToSection(id: string) {
  const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const go = () => document.getElementById(id)?.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' })
  const onHome = window.location.hash.replace(/^#\/?/, '') === ''
  if (onHome) go()
  else {
    navigate('')
    window.setTimeout(go, 80)
  }
}
