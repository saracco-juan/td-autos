import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { parseVehicleId, vehicleTitle } from '@shared/checklist/inspection/vehicle'
import type { DepreciationResponse } from '@shared/depreciation/types'
import ErrorState, { type ErrorKind } from '../../components/ErrorState'
import screenStyles from '../../components/screen.module.css'
import { apiFetch, HttpError, NetworkError } from '../../lib/http'
import SessionLoading from '../auth/session/SessionLoading'
import backIcon from '../vehicle-detail/back.svg'
import styles from '../vehicle-detail/VehicleDetailPage.module.css'
import DepreciationResult from './DepreciationResult'

type View = { status: 'loading' | 'unavailable' }
  | { status: 'error'; kind: ErrorKind }
  | { status: 'ready'; data: DepreciationResponse }

export default function DepreciationPage() {
  const { id } = useParams()
  const { state } = useLocation()
  return <DepreciationScreen key={id} id={parseVehicleId(id)} returnState={state} />
}

function DepreciationScreen({ id, returnState }: { id: number | null; returnState: unknown }) {
  const [view, setView] = useState<View>({ status: id === null ? 'unavailable' : 'loading' })
  const [attempt, setAttempt] = useState(0)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (id === null) return
    let active = true
    apiFetch<DepreciationResponse>(`/api/vehiculos/${id}/depreciacion`).then((data) => {
      if (active) setView({ status: 'ready', data })
    }).catch((error: unknown) => {
      if (!active) return
      setView(error instanceof HttpError && error.status === 404 ? { status: 'unavailable' }
        : { status: 'error', kind: error instanceof NetworkError ? 'network' : 'server' })
    })
    return () => { active = false }
  }, [id, attempt])
  useEffect(() => { heading.current?.focus() }, [view.status])

  return (
    <div className={styles.page}>
      <Link to={id === null ? '/recomendaciones' : `/vehiculos/${id}`} state={returnState} className={styles.back}>
        <span className={styles.backIcon}><img src={backIcon} alt="" /></span>
        {id === null ? 'Volver a recomendados' : 'Volver a la ficha'}
      </Link>
      {view.status === 'loading' ? <SessionLoading /> : null}
      {view.status === 'unavailable' ? <section role="status">
        <h1 ref={heading} tabIndex={-1} className={screenStyles.title}>Esta publicación ya no está disponible.</h1>
        <Link to="/recomendaciones">Ver recomendados</Link>
      </section> : null}
      {view.status === 'error' ? <ErrorState kind={view.kind} onRetry={() => {
        setView({ status: 'loading' })
        setAttempt((value) => value + 1)
      }} /> : null}
      {view.status === 'ready' ? <>
        <header>
          <p className={screenStyles.eyebrow}>DEPRECIACIÓN Y REVENTA</p>
          <h1 ref={heading} tabIndex={-1} className={screenStyles.title}>{vehicleTitle(view.data.vehicle)}</h1>
          <p className={styles.muted}>Estimación a partir del precio publicado y de referencias de vehículos comparables.</p>
        </header>
        {view.data.projection && view.data.reference ? <DepreciationResult projection={view.data.projection}
          reference={view.data.reference} kilometers={view.data.vehicle.kilometraje} />
          : <section role="status" className={styles.summary}>
            <h2>No hay datos suficientes para estimar la depreciación.</h2>
            <p>Necesitamos un precio publicado válido y referencias comparables suficientes. Podés volver a la ficha o consultar otro vehículo.</p>
          </section>}
      </> : null}
    </div>
  )
}
