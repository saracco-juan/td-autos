import { useEffect, useState } from 'react'
import type { ErrorKind } from '../../components/ErrorState'
import { NetworkError } from '../../lib/http'

export type ApiView<T> =
  | { status: 'loading' }
  | { status: 'error'; kind: ErrorKind }
  | { status: 'ready'; response: T }

// Requests on mount (and again on `retry`) with its own loading and error state. `fetcher` must be a stable function.
export function useApiView<T>(fetcher: () => Promise<T>): { view: ApiView<T>; retry: () => void } {
  const [view, setView] = useState<ApiView<T>>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    fetcher()
      .then((response) => {
        if (active) setView({ status: 'ready', response })
      })
      .catch((error: unknown) => {
        if (active) setView({ status: 'error', kind: error instanceof NetworkError ? 'network' : 'server' })
      })
    return () => { active = false }
  }, [fetcher, attempt])
  return {
    view,
    retry: () => {
      setView({ status: 'loading' })
      setAttempt((value) => value + 1)
    },
  }
}
