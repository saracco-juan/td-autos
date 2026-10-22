import { useCallback, useEffect, useState } from 'react'
import type { ErrorKind } from '../../components/ErrorState'
import { NetworkError } from '../../lib/http'
import { fetchDealerDirectory } from './api'
import type { DealerDirectory } from './types'

export type DirectoryState = 'loading' | { error: ErrorKind } | { data: DealerDirectory }

// Loads the dealer directory the dashboard and the list share; `retry` reloads it after a failure.
export function useDealerDirectory(): { state: DirectoryState; retry: () => void } {
  const [state, setState] = useState<DirectoryState>('loading')

  // `isCancelled` lets the effect drop the answer of a page that is gone.
  const load = useCallback((isCancelled: () => boolean = () => false) => {
    fetchDealerDirectory()
      .then((data) => {
        if (!isCancelled()) setState({ data })
      })
      .catch((error: unknown) => {
        if (!isCancelled()) setState({ error: error instanceof NetworkError ? 'network' : 'server' })
      })
  }, [])

  useEffect(() => {
    let cancelled = false
    load(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [load])

  const retry = useCallback(() => {
    setState('loading')
    load()
  }, [load])

  return { state, retry }
}
