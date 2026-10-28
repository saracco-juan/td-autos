import { useEffect, useRef, useState } from 'react'
import type { FavoriteVehicle } from '@shared/favorites/types'
import type { ErrorKind } from '../../components/ErrorState'
import { NetworkError } from '../../lib/http'
import { listFavorites, setFavorite } from './api'

type FavoritesView = { status: 'loading' } | { status: 'error'; kind: ErrorKind } | { status: 'ready' }
type FavoriteAction = { vehicle: FavoriteVehicle; saved: boolean }

export function useFavoritesList() {
  const [view, setView] = useState<FavoritesView>({ status: 'loading' })
  const [items, setItems] = useState<FavoriteVehicle[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(6)
  const [lastPage, setLastPage] = useState(1)
  const [attempt, setAttempt] = useState(0)
  const [pendingIds, setPendingIds] = useState<number[]>([])
  const [actionError, setActionError] = useState<FavoriteAction | null>(null)
  const [removed, setRemoved] = useState<{ vehicle: FavoriteVehicle } | null>(null)
  const activeActions = useRef(new Set<number>())

  useEffect(() => {
    let active = true
    listFavorites({ page, perPage }).then((result) => {
      if (!active) return
      const last = Math.max(1, result.meta.last_page)
      if (page > last) {
        setPage(last)
        return
      }
      setItems(result.data)
      setTotal(result.meta.total)
      setLastPage(last)
      setView({ status: 'ready' })
    }).catch((error: unknown) => {
      if (active) setView({ status: 'error', kind: error instanceof NetworkError ? 'network' : 'server' })
    })
    return () => { active = false }
  }, [page, perPage, attempt])

  const refresh = () => {
    setView({ status: 'loading' })
    setAttempt((value) => value + 1)
  }

  const runAction = async (action: FavoriteAction) => {
    const { vehicle, saved } = action
    if (activeActions.current.has(vehicle.id)) return
    activeActions.current.add(vehicle.id)
    setPendingIds((ids) => [...ids, vehicle.id])
    setActionError(null)
    try {
      await setFavorite(vehicle.id, saved)
      setRemoved(saved ? null : { vehicle })
      refresh()
    } catch {
      setActionError(action)
    } finally {
      activeActions.current.delete(vehicle.id)
      setPendingIds((ids) => ids.filter((id) => id !== vehicle.id))
    }
  }

  const changePageSize = (size: number) => {
    if (size === perPage) return
    setView({ status: 'loading' })
    setPage(1)
    setPerPage(size)
  }
  const changePage = (nextPage: number) => {
    if (nextPage === page) return
    setView({ status: 'loading' })
    setPage(nextPage)
  }

  return {
    view, items, total, page, perPage, lastPage, pendingIds, actionError, removed,
    remove: (vehicle: FavoriteVehicle) => runAction({ vehicle, saved: false }),
    undo: () => removed ? runAction({ vehicle: removed.vehicle, saved: true }) : undefined,
    retry: refresh,
    setPage: changePage,
    changePageSize,
    retryAction: () => actionError ? runAction(actionError) : undefined,
  }
}
