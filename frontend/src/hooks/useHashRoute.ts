import { useCallback, useEffect, useState } from 'react'

/* Reads the page name from the address hash. '#/books' gives '/books'. Anything else gives '/'. */
function read(): string {
  const h = window.location.hash.replace(/^#/, '')
  return h.startsWith('/') ? h : '/'
}

export function useHashRoute(): [string, (path: string) => void] {
  const [path, setPath] = useState(read)
  useEffect(() => {
    const on = () => setPath(read())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  const go = useCallback((p: string) => {
    window.location.hash = p === '/' ? '' : p
    setPath(p)
  }, [])
  return [path, go]
}
