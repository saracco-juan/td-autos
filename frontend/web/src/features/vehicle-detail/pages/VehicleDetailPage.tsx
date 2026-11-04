import ButtonLink from '../../../components/Buttons/ButtonLink'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useParams } from 'react-router'
import { parseVehicleId, vehicleTitle } from '@shared/checklist/inspection/vehicle'
import { specificationGroups } from '@shared/vehicles/detail'
import screenStyles from '../../../styles/screen.module.css'
import ErrorState, { type ErrorKind } from '../../../components/ErrorState/ErrorState'
import { HttpError, NetworkError } from '../../../lib/http'
import SessionLoading from '../../auth/session/components/SessionLoading'
import FavoriteButton from '../../favorites/components/FavoriteButton'
import { formatPrice } from '../../inventory/model/format'
import { fetchVehicleDetail } from '../api/client'
import { readDetailContext, readDetailReturn, type DetailContext } from '../model/navigation'
import type { VehicleDetailResponse } from '../model/types'
import VehicleCostShortcut from '../components/VehicleCostShortcut'
import VehicleGallery from '../components/VehicleGallery'
import VehicleSpecifications from '../components/VehicleSpecifications'
import VehicleCompatibility from '../components/VehicleCompatibility'
import VehicleContact from '../components/VehicleContact'
import BackLink from '../../../components/Buttons/BackLink'
import styles from './VehicleDetailPage.module.css'

type View = { status: 'loading' | 'unavailable' }
  | { status: 'error'; kind: ErrorKind }
  | { status: 'ready'; response: VehicleDetailResponse }

export default function VehicleDetailPage() {
  const { id } = useParams()
  const { state } = useLocation()
  const vehicleId = parseVehicleId(id)
  const context = readDetailContext(state, vehicleId)
  return <DetailScreen key={id} id={vehicleId} context={context} returnTo={readDetailReturn(state, context)} returnState={state} />
}

function DetailScreen({ id, context, returnTo, returnState }: { id: number | null; context: DetailContext | null; returnTo: { to: string; label: string }; returnState: unknown }) {
  const [view, setView] = useState<View>({ status: id === null ? 'unavailable' : 'loading' })
  const [attempt, setAttempt] = useState(0)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (id === null) return
    let active = true
    fetchVehicleDetail(id).then((response) => {
      if (active) setView({ status: 'ready', response })
    }).catch((error: unknown) => {
      if (!active) return
      setView(error instanceof HttpError && error.status === 404 ? { status: 'unavailable' }
        : { status: 'error', kind: error instanceof NetworkError ? 'network' : 'server' })
    })
    return () => { active = false }
  }, [id, attempt])
  useEffect(() => { heading.current?.focus() }, [view.status])

  const data = view.status === 'ready' ? view.response : null
  const title = data ? vehicleTitle(data.vehicle) : ''
  const subtitle = data ? specificationGroups(data.vehicle)[0].rows
    .filter(({ label }) => ['Kilometraje', 'Ubicación', 'Transmisión', 'Combustible'].includes(label))
    .map(({ value }) => value).join(' · ') : ''
  return (
    <div className={styles.page}>
      <BackLink to={returnTo.to}>{returnTo.label}</BackLink>
      {view.status === 'loading' ? <SessionLoading /> : null}
      {view.status === 'unavailable' ? (
        <section role="status">
          <h1 className={screenStyles.title}>Esta publicación ya no está disponible.</h1>
          <p>Volvé a tus recomendaciones para elegir otro vehículo.</p>
        </section>
      ) : null}
      {view.status === 'error' ? <ErrorState kind={view.kind} onRetry={() => {
        setView({ status: 'loading' })
        setAttempt((value) => value + 1)
      }} /> : null}
      {data ? (
        <>
          <header className={styles.heading}>
            <h1 ref={heading} tabIndex={-1} className={styles.title}>{title}</h1>
            <p className={styles.muted}>{subtitle}</p>
          </header>
          <div className={styles.body}>
            <div className={styles.gallery}><VehicleGallery photos={data.vehicle.fotos} title={title} /></div>
            <div className={styles.sidebar}>
              <aside className={styles.summary} aria-label="Resumen de la publicación">
                <div className={styles.priceRow}>
                  <p className={styles.price}>{data.vehicle.precio === null || data.vehicle.moneda === null
                    ? 'Precio no disponible.' : formatPrice(data.vehicle.precio, data.vehicle.moneda).replace('US$', 'USD')}</p>
                  <FavoriteButton vehicleId={data.vehicle.id} vehicleName={title} isFavorite={data.is_favorite ?? false} />
                </div>
                <p className={styles.muted}>Concesionaria verificada · {data.dealer.nombre}</p>
                <VehicleContact vehicleId={data.vehicle.id} available={data.whatsapp_available === true} />
                <VehicleCostShortcut vehicleId={data.vehicle.id} context={context} />
                <ButtonLink to={`/vehiculos/${id}/depreciacion`} state={returnState} variant="secondary">
                  DEPRECIACIÓN Y REVENTA
                </ButtonLink>
                <ButtonLink to={`/vehiculos/${id}/inspeccion`} variant="secondary">
                  CHECKLIST DE INSPECCIÓN
                </ButtonLink>
              </aside>
              <VehicleSpecifications vehicle={data.vehicle} />
            </div>
          </div>
          <div className={styles.compatibility}><VehicleCompatibility context={context} /></div>
        </>
      ) : null}
    </div>
  )
}
