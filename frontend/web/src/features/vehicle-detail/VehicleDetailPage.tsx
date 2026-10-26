import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { parseVehicleId, vehicleTitle } from '@shared/checklist/inspection/vehicle'
import { specificationGroups } from '@shared/vehicles/detail'
import buttonStyles from '../../components/button.module.css'
import screenStyles from '../../components/screen.module.css'
import ErrorState, { type ErrorKind } from '../../components/ErrorState'
import { HttpError, NetworkError } from '../../lib/http'
import SessionLoading from '../auth/session/SessionLoading'
import { formatPrice } from '../inventory/format'
import { fetchVehicleDetail } from './api'
import { readDetailContext, type DetailContext } from './navigation'
import type { VehicleDetailResponse } from './types'
import VehicleCostShortcut from './VehicleCostShortcut'
import VehicleGallery from './VehicleGallery'
import VehicleSpecifications from './VehicleSpecifications'
import VehicleCompatibility from './VehicleCompatibility'
import backIcon from './back.svg'
import styles from './VehicleDetailPage.module.css'

type View = { status: 'loading' | 'unavailable' }
  | { status: 'error'; kind: ErrorKind }
  | { status: 'ready'; response: VehicleDetailResponse }

export default function VehicleDetailPage() {
  const { id } = useParams()
  const { state } = useLocation()
  const vehicleId = parseVehicleId(id)
  return <DetailScreen key={id} id={vehicleId} context={readDetailContext(state, vehicleId)} />
}

function DetailScreen({ id, context }: { id: number | null; context: DetailContext | null }) {
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
    .map(({ label, value }) => `${label}: ${value}`).join(' · ') : ''
  return (
    <div className={styles.page}>
      <Link className={styles.back} to={context?.returnTo ?? '/recomendaciones'}>
        <span className={styles.backIcon}><img src={backIcon} alt="" /></span>
        Volver a recomendados
      </Link>
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
          <header>
            <p className={screenStyles.eyebrow}>FICHA TÉCNICA</p>
            <h1 ref={heading} tabIndex={-1} className={screenStyles.title}>{title}</h1>
            <p className={styles.muted}>{subtitle}</p>
          </header>
          <div className={styles.body}>
            <div className={styles.gallery}><VehicleGallery photos={data.vehicle.fotos} title={title} /></div>
            <div className={styles.sidebar}>
              <aside className={styles.summary} aria-label="Resumen de la publicación">
                <p className={styles.price}>{data.vehicle.precio === null || data.vehicle.moneda === null
                  ? 'Precio no disponible.' : formatPrice(data.vehicle.precio, data.vehicle.moneda)}</p>
                <p className={styles.muted}>Concesionaria verificada · {data.dealer.nombre}</p>
                <VehicleCostShortcut />
                <Link to={`/vehiculos/${id}/inspeccion`} className={`${buttonStyles.button} ${buttonStyles.secondary}`}>
                  CHECKLIST DE INSPECCIÓN
                </Link>
              </aside>
              <VehicleCompatibility context={context} />
            </div>
            <div className={styles.specifications}><VehicleSpecifications vehicle={data.vehicle} /></div>
          </div>
        </>
      ) : null}
    </div>
  )
}
