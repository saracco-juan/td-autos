import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { canCompare } from '@shared/comparison/selection'
import buttonStyles from '../../components/button.module.css'
import screenStyles from '../../components/screen.module.css'
import ErrorState from '../../components/ErrorState'
import { HttpError, NetworkError } from '../../lib/http'
import SessionLoading from '../auth/session/SessionLoading'
import { fetchCosts } from '../costs/api'
import { fetchRecommendations } from '../recommendations/matching'
import { fetchVehicleDetail } from '../vehicle-detail/api'
import ComparisonTable, { type ComparisonEntry } from './ComparisonTable'
import { useComparisonSelection } from './useComparisonSelection'
import backIcon from '../vehicle-detail/back.svg'
import detailStyles from '../vehicle-detail/VehicleDetailPage.module.css'
import styles from './ComparisonPage.module.css'

type View = { status: 'loading' } | { status: 'unavailable' }
  | { status: 'error'; network: boolean }
  | { status: 'ready'; entries: [ComparisonEntry, ComparisonEntry] }

export default function ComparisonPage() {
  const { ids, search, toggle } = useComparisonSelection()
  return <div className={styles.page}>
    <Link className={detailStyles.back} to={`/recomendaciones${search.size ? `?${search}` : ''}`}>
      <span className={detailStyles.backIcon}><img src={backIcon} alt="" /></span>Volver a recomendados
    </Link>
    <header>
      <p className={screenStyles.eyebrow}>COMPARAR UNIDADES</p>
      <h1 className={screenStyles.title}>Comparar vehículos</h1>
      <p>{ids.length} vehículos seleccionados</p>
    </header>
    {canCompare(ids) ? <ReadyComparison key={ids.join(',')} ids={ids as [number, number]} onRemove={toggle} />
      : <section role="status">
        <p>Seleccioná exactamente dos vehículos recomendados para completar la comparación.</p>
        {ids.map((id) => <p key={id}>Conservás el vehículo {id}. <Link to={`/vehiculos/${id}`}>Ver ficha</Link></p>)}
      </section>}
  </div>
}

function ReadyComparison({ ids, onRemove }: { ids: [number, number]; onRemove: (id: number) => void }) {
  const [view, setView] = useState<View>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const ready = useRef<HTMLDivElement>(null)
  const [first, second] = ids
  useEffect(() => {
    let active = true
    async function load() {
      const recommendations = await fetchRecommendations()
      const selected = [first, second].map((id) => recommendations.results.find((result) => result.listing_id === id))
      if (recommendations.status !== 'ready' || selected.some((result) => !result)) {
        if (active) setView({ status: 'unavailable' })
        return
      }
      const entries = await Promise.all([first, second].map(async (id, index) => {
        const [detail, costs] = await Promise.all([fetchVehicleDetail(id), fetchCosts(id)])
        return { id, detail, costs, recommendation: selected[index]! }
      }))
      if (active) setView({ status: 'ready', entries: [entries[0], entries[1]] })
    }
    load().catch((error: unknown) => {
      if (active) setView(error instanceof HttpError && error.status === 404 ? { status: 'unavailable' }
        : { status: 'error', network: error instanceof NetworkError })
    })
    return () => { active = false }
  }, [first, second, attempt])
  useEffect(() => { if (view.status === 'ready') ready.current?.focus() }, [view.status])
  if (view.status === 'loading') return <SessionLoading />
  if (view.status === 'unavailable') return <p role="status">Algún vehículo ya no está disponible entre tus recomendaciones. Volvé y corregí la selección.</p>
  if (view.status === 'error') return <ErrorState kind={view.network ? 'network' : 'server'} onRetry={() => {
    setView({ status: 'loading' })
    setAttempt((value) => value + 1)
  }} />
  return <div ref={ready} tabIndex={-1} className={styles.ready}>
    <ComparisonTable entries={view.entries} onRemove={onRemove} />
    <Link className={buttonStyles.button} to="/recomendaciones">ELEGIR OTROS VEHÍCULOS</Link>
  </div>
}
