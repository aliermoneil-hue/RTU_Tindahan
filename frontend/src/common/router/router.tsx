import { useEffect, useState, type AnchorHTMLAttributes } from 'react'

/**
 * TINY HASH ROUTER
 * ---------------------------------------------------------------
 * Pages live after the # in the address bar:
 *   http://localhost:5173/#/login          -> path "login"
 *   http://localhost:5173/#/browse?q=pen   -> path "browse", q = "pen"
 *   http://localhost:5173/                 -> path ""  (home)
 * No extra library is needed and refreshing the page always works.
 */

export interface Route {
  path: string
  params: URLSearchParams
}

function readRoute(): Route {
  const raw = window.location.hash.replace(/^#\/?/, '')
  const [path, query = ''] = raw.split('?')
  return { path: path.replace(/\/+$/, ''), params: new URLSearchParams(query) }
}

/** Go to another page. navigate('login'), navigate('browse?q=pen'). */
export function navigate(to: string, options: { replace?: boolean } = {}) {
  const target = `#/${to.replace(/^\/+/, '')}`
  if (options.replace) window.location.replace(target)
  else window.location.hash = target
  window.scrollTo({ top: 0 })
}

/** Returns the current route and re-renders when the address changes. */
export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(readRoute)
  useEffect(() => {
    const onChange = () => setRoute(readRoute())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  to: string
}

/** Like <a>, but for pages inside this app: <Link to="login">Sign in</Link> */
export function Link({ to, children, ...props }: LinkProps) {
  return (
    <a href={`#/${to.replace(/^\/+/, '')}`} {...props}>
      {children}
    </a>
  )
}
