import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import alertStyles from '../../components/alert.module.css'
import ErrorState, { type ErrorKind } from '../../components/ErrorState'
import { HttpError, NetworkError } from '../../lib/http'
import SessionLoading from '../auth/session/SessionLoading'
import { fetchVehicle, updateVehicle } from './api'
import styles from './EditVehiclePage.module.css'
import { inactiveSubscription, type InactiveSubscription } from './inactiveSubscription'
import { INVENTORY_PATH, goToInventory } from './inventoryRoutes'
import SubscriptionBlockedNotice from './SubscriptionBlockedNotice'
import type { Vehiculo } from './types'
import VehicleForm from './VehicleForm'
import VehicleFormPage from './VehicleFormPage'
import { valuesFromVehicle } from './vehicleFields'

type LoadState = 'loading' | 'not-found' | { vehicle: Vehiculo } | { error: ErrorKind } | { blocked: InactiveSubscription }

const EDIT_SUBTITLE = 'La patente debe ser única en toda la plataforma.'

function NotFound() {
  return (
    <div className={styles.notFound}>
      <p role="alert" className={alertStyles.alert}>
        No encontramos ese vehículo.
      </p>
      <Link to={INVENTORY_PATH} className={styles.back}>
        Volver al inventario
      </Link>
    </div>
  )
}

// Edit a vehicle (Figma 2119:1841, CU-19): the form arrives prefilled with the saved photos.
// A vehicle that is not the dealer's answers 404, shown like one that does not exist.
export default function EditVehiclePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const vehicleId = id !== undefined && /^\d+$/.test(id) ? Number(id) : null
  const [loadState, setLoadState] = useState<LoadState>('loading')

  const load = useCallback(
    (isCancelled: () => boolean = () => false) => {
      if (vehicleId === null) return
      fetchVehicle(vehicleId)
        .then((vehicle) => {
          if (!isCancelled()) setLoadState({ vehicle })
        })
        .catch((error: unknown) => {
          if (isCancelled()) return
          const blocked = inactiveSubscription(error)
          if (blocked) setLoadState({ blocked })
          else if (error instanceof HttpError && error.status === 404) setLoadState('not-found')
          else setLoadState({ error: error instanceof NetworkError ? 'network' : 'server' })
        })
    },
    [vehicleId],
  )

  useEffect(() => {
    let cancelled = false
    load(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [load])

  const retry = () => {
    setLoadState('loading')
    load()
  }

  // The loader and the error are direct children of the content area so they are centered there.
  if (vehicleId === null || loadState === 'not-found') return <NotFound />
  if (loadState === 'loading') return <SessionLoading />
  if ('blocked' in loadState) {
    return (
      <VehicleFormPage title="Editar vehículo" subtitle={EDIT_SUBTITLE}>
        <SubscriptionBlockedNotice info={loadState.blocked} />
      </VehicleFormPage>
    )
  }
  if ('error' in loadState) return <ErrorState kind={loadState.error} onRetry={retry} />

  const { vehicle } = loadState
  return (
    <VehicleFormPage title="Editar vehículo" subtitle={EDIT_SUBTITLE}>
      <VehicleForm
        initialValues={valuesFromVehicle(vehicle)}
        initialPhotos={vehicle.fotos}
        submitLabel="GUARDAR CAMBIOS"
        onSubmit={async (submission) => {
          await updateVehicle(vehicle.id, submission)
          goToInventory(navigate, 'Guardaste los cambios.')
        }}
      />
    </VehicleFormPage>
  )
}
