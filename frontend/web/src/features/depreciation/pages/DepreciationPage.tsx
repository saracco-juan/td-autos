import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { parseVehicleId, vehicleTitle } from '@shared/checklist/inspection/vehicle'
import type { DepreciationResponse } from '@shared/depreciation/types'
import { depreciationCopy } from '@shared/depreciation/presentation'
import ErrorState, { type ErrorKind } from '../../../components/ErrorState/ErrorState'
import BackLink from '../../../components/Buttons/BackLink'
import { apiFetch, HttpError, NetworkError } from '../../../lib/http'
import SessionLoading from '../../auth/session/components/SessionLoading'
import styles from './DepreciationPage.module.css'
import DepreciationResult from '../components/DepreciationResult'

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
      <BackLink to={id === null ? '/recomendaciones' : `/vehiculos/${id}`} state={returnState}>
        {id === null ? 'Volver a recomendados' : 'Volver a la ficha'}
      </BackLink>
      {view.status === 'loading' ? <SessionLoading /> : null}
      {view.status === 'unavailable' ? <section role="status">
        <h1 ref={heading} tabIndex={-1} className={styles.title}>Esta publicación ya no está disponible.</h1>
        <Link to="/recomendaciones">Ver recomendados</Link>
      </section> : null}
      {view.status === 'error' ? <ErrorState kind={view.kind} onRetry={() => {
        setView({ status: 'loading' })
        setAttempt((value) => value + 1)
      }} /> : null}
      {view.status === 'ready' ? <>
        <header className={styles.header}>
          <h1 ref={heading} tabIndex={-1} className={styles.title}>{vehicleTitle(view.data.vehicle)}</h1>
          <p className={styles.subtitle}>{depreciationCopy.subtitle}</p>
        </header>
        {view.data.projection && view.data.reference ? <DepreciationResult projection={view.data.projection}
          reference={view.data.reference} kilometers={view.data.vehicle.kilometraje} />
          : <section role="status" className={styles.empty}>
            <h2>{depreciationCopy.insufficient}</h2>
            <p>{depreciationCopy.insufficientHint}</p>
          </section>}
      </> : null}
    </div>
  )
}
