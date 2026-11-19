import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { canCompare } from '@shared/comparison/selection'
import BackLink from '../../../components/Buttons/BackLink'
import screenStyles from '../../../styles/screen.module.css'
import ErrorState from '../../../components/ErrorState/ErrorState'
import { HttpError, NetworkError } from '../../../lib/http'
import SessionLoading from '../../auth/session/components/SessionLoading'
import { fetchCosts } from '../../costs/api/client'
import { fetchRecommendations } from '../../recommendations/api/matching'
import { fetchVehicleDetail } from '../../vehicle-detail/api/client'
import ComparisonTable, { type ComparisonEntry } from '../components/ComparisonTable'
import { useComparisonSelection } from '../hooks/useComparisonSelection'
import styles from './ComparisonPage.module.css'

type View = { status: 'loading' } | { status: 'unavailable' }
  | { status: 'error'; network: boolean }
  | { status: 'ready'; entries: [ComparisonEntry, ComparisonEntry] }

export default function ComparisonPage() {
  const { ids, search, toggle } = useComparisonSelection()
  const fromFavorites = search.get('source') === 'favorites'
  const favoriteReturnParams = new URLSearchParams()
  if (search.has('compare')) favoriteReturnParams.set('compare', search.get('compare')!)
  if (fromFavorites) favoriteReturnParams.set('source', 'favorites')
  const favoriteReturnQuery = favoriteReturnParams.toString()
  const favoriteReturnTo = favoriteReturnQuery ? `/favoritos?${favoriteReturnQuery}` : '/favoritos'
  const recommendationsReturnTo = search.size ? `/recomendaciones?${search}` : '/recomendaciones'
  return <div className={styles.page}>
    {fromFavorites ? <BackLink to={favoriteReturnTo}>Volver a favoritos</BackLink>
      : <BackLink to={recommendationsReturnTo}>Volver a recomendados</BackLink>}
    <header className={styles.heading}>
      <p className={screenStyles.eyebrow}>COMPARAR UNIDADES</p>
      <h1 className={screenStyles.title}>Comparar vehículos</h1>
      <p>{ids.length} {ids.length === 1 ? 'vehículo seleccionado' : 'vehículos seleccionados'}</p>
    </header>
    {canCompare(ids) ? <ReadyComparison key={ids.join(',')} ids={ids as [number, number]} onRemove={toggle} fromFavorites={fromFavorites} />
      : <section>
        <p><output>{fromFavorites ? 'Seleccioná exactamente dos vehículos favoritos para completar la comparación.'
          : 'Seleccioná exactamente dos vehículos recomendados para completar la comparación.'}</output></p>
        {ids.map((id) => <p key={id}>Conservás el vehículo {id}. <Link to={`/vehiculos/${id}`}>Ver ficha</Link></p>)}
      </section>}
  </div>
}

type ReadyComparisonProps = Readonly<{
  ids: readonly [number, number]; onRemove: (id: number) => void; fromFavorites: boolean
}>

function ReadyComparison({ ids, onRemove, fromFavorites }: ReadyComparisonProps) {
  const [view, setView] = useState<View>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const ready = useRef<HTMLDivElement>(null)
  const [first, second] = ids
  useEffect(() => {
    let active = true
    async function load() {
      if (fromFavorites) {
        const recommendationsPromise = fetchRecommendations().catch(() => null)
        const entries = await Promise.all([first, second].map(async (id) => {
          const [detail, costs] = await Promise.all([fetchVehicleDetail(id), fetchCosts(id)])
          return { id, detail, costs }
        }))
        const recommendations = await recommendationsPromise
        const withRecommendations = entries.map((entry) => ({ ...entry, recommendation: recommendations?.status === 'ready'
          ? recommendations.results.find((result) => result.listing_id === entry.id) ?? null : null }))
        if (active) setView({ status: 'ready', entries: [withRecommendations[0], withRecommendations[1]] })
        return
      }
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
  }, [first, second, attempt, fromFavorites])
  useEffect(() => { if (view.status === 'ready') ready.current?.focus() }, [view.status])
  if (view.status === 'loading') return <SessionLoading />
  if (view.status === 'unavailable') return <p><output>{fromFavorites
    ? 'Algún vehículo ya no está disponible. Volvé y corregí la selección.'
    : 'Algún vehículo ya no está disponible entre tus recomendaciones. Volvé y corregí la selección.'}</output></p>
  if (view.status === 'error') return <ErrorState kind={view.network ? 'network' : 'server'} onRetry={() => {
    setView({ status: 'loading' })
    setAttempt((value) => value + 1)
  }} />
  return <div ref={ready} tabIndex={-1} className={styles.ready}>
    <ComparisonTable entries={view.entries} onRemove={onRemove} />
  </div>
}
