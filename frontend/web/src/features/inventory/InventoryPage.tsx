import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import alertStyles from '../../components/alert.module.css'
import buttonStyles from '../../components/button.module.css'
import ErrorState, { type ErrorKind } from '../../components/ErrorState'
import screenStyles from '../../components/screen.module.css'
import { HttpError, NetworkError } from '../../lib/http'
import SessionLoading from '../auth/session/SessionLoading'
import { deleteVehicle, fetchVehicles } from './api'
import styles from './InventoryPage.module.css'
import type { InventoryLocationState } from './inventoryRoutes'
import type { Vehiculo } from './types'
import VehicleRow from './VehicleRow'

type LoadState = 'loading' | 'ready' | { error: ErrorKind }

const REMOVED_NOTICE = 'Eliminaste el vehículo.'

// The message the form leaves in the navigation state (saved or edited); anything else is ignored.
function noticeFrom(state: unknown): string | null {
  const notice = (state as InventoryLocationState | null)?.notice
  return typeof notice === 'string' ? notice : null
}

// Dealer inventory (Figma 38:884, UH-21): the dealer's vehicles with EDITAR and ELIMINAR, and the load action.
// IMPORTAR CSV opens the import (UH-22); SUSCRIPCIÓN of the frame waits for its own story.
export default function InventoryPage() {
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [vehicles, setVehicles] = useState<Vehiculo[]>([])
  const [confirmingId, setConfirmingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [failedId, setFailedId] = useState<number | null>(null)
  const location = useLocation()
  const navigate = useNavigate()
  // Success message of the last action: a save that brought the dealer here, or a delete done on this page.
  const [notice, setNotice] = useState<string | null>(() => noticeFrom(location.state))
  const noticeRef = useRef<HTMLParagraphElement>(null)

  // The message lives in the history entry, which a reload keeps: take it out so it is shown once.
  useEffect(() => {
    if (noticeFrom(location.state) !== null) navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, location.state, navigate])

  // `isCancelled` lets the effect drop the answer of a page that is gone.
  const loadList = useCallback((isCancelled: () => boolean = () => false) => {
    fetchVehicles()
      .then((list) => {
        if (isCancelled()) return
        setVehicles(list)
        setLoadState('ready')
      })
      .catch((error: unknown) => {
        if (isCancelled()) return
        setLoadState({ error: error instanceof NetworkError ? 'network' : 'server' })
      })
  }, [])

  useEffect(() => {
    let cancelled = false
    loadList(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [loadList])

  const retry = () => {
    setLoadState('loading')
    loadList()
  }

  // The message takes the focus once it is on screen (after a delete the row that held it is gone), so the result is announced.
  const ready = loadState === 'ready'
  useEffect(() => {
    if (notice && ready) noticeRef.current?.focus()
  }, [notice, ready])

  const removeRow = (id: number) => {
    setVehicles((current) => current.filter((vehicle) => vehicle.id !== id))
    setConfirmingId(null)
    setNotice(REMOVED_NOTICE)
  }

  const askDelete = (id: number) => {
    setNotice(null)
    setFailedId(null)
    setConfirmingId(id)
  }

  const confirmDelete = async (id: number) => {
    setNotice(null)
    setFailedId(null)
    setDeletingId(id)
    try {
      await deleteVehicle(id)
      removeRow(id)
    } catch (error) {
      // A 404 means the vehicle is already gone: the list was stale, not the delete.
      if (error instanceof HttpError && error.status === 404) removeRow(id)
      else setFailedId(id)
    } finally {
      setDeletingId(null)
    }
  }

  // The loader and the error are direct children of the content area so they are centered there.
  if (loadState === 'loading') return <SessionLoading />
  if (typeof loadState === 'object') return <ErrorState kind={loadState.error} onRetry={retry} />

  return (
    <div className={screenStyles.page}>
      <div className={styles.header}>
        <p className={screenStyles.eyebrow}>INVENTARIO</p>
        <h1 className={screenStyles.title}>Inventario</h1>
        <p className={styles.subtitle}>Activa · funciones habilitadas</p>
      </div>
      <section className={styles.card} aria-labelledby="inventory-inclusion-title">
        <h2 id="inventory-inclusion-title" className={styles.cardTitle}>
          Inclusión automática
        </h2>
        <p className={styles.cardBody}>
          Las unidades guardadas participan directamente en búsquedas y recomendaciones. No hay publicación manual, pausa ni
          archivo de vigencia.
        </p>
      </section>
      {notice ? (
        <p ref={noticeRef} tabIndex={-1} role="status" className={`${alertStyles.notice} ${styles.message}`}>
          {notice}
        </p>
      ) : null}
      {vehicles.length === 0 ? (
        <p className={styles.empty}>Todavía no cargaste vehículos.</p>
      ) : (
        <ul className={styles.list}>
          {vehicles.map((vehicle) => (
            <VehicleRow
              key={vehicle.id}
              vehicle={vehicle}
              confirming={confirmingId === vehicle.id}
              deleting={deletingId === vehicle.id}
              failed={failedId === vehicle.id}
              locked={deletingId !== null}
              onAskDelete={() => askDelete(vehicle.id)}
              onCancel={() => setConfirmingId(null)}
              onConfirm={() => void confirmDelete(vehicle.id)}
            />
          ))}
        </ul>
      )}
      <div className={styles.actions}>
        <Link to="/concesionaria/inventario/nuevo" className={`${buttonStyles.button} ${buttonStyles.primary} ${styles.load}`}>
          CARGAR VEHÍCULO
        </Link>
        <Link to="/concesionaria/inventario/importar" className={`${buttonStyles.button} ${buttonStyles.secondary} ${styles.load}`}>
          IMPORTAR CSV
        </Link>
      </div>
    </div>
  )
}
