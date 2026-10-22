import { useSyncExternalStore } from 'react'

// Follows a CSS media query. Where `matchMedia` does not exist (tests, old browsers) it never matches.
export function useMediaQuery(query: string): boolean {
  const subscribe = (notify: () => void) => {
    if (typeof window.matchMedia !== 'function') return () => {}
    const list = window.matchMedia(query)
    list.addEventListener('change', notify)
    return () => list.removeEventListener('change', notify)
  }
  const getSnapshot = () => typeof window.matchMedia === 'function' && window.matchMedia(query).matches

  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
