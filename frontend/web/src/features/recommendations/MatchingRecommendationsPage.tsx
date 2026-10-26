import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { filterRecommendations } from '@shared/recommendations/filters'
import alertStyles from '../../components/alert.module.css'
import buttonStyles from '../../components/button.module.css'
import ErrorState, { type ErrorKind } from '../../components/ErrorState'
import ListFooter from '../../components/ListFooter'
import Pagination from '../../components/Pagination'
import ScrollArea from '../../components/ScrollArea'
import screenStyles from '../../components/screen.module.css'
import { NetworkError } from '../../lib/http'
import SessionLoading from '../auth/session/SessionLoading'
import { formatPrice } from '../inventory/format'
import { fetchRecommendations, type RecommendationsResponse } from './matching'
import MatchingVehicleCard from './MatchingVehicleCard'
import RecommendationFilters from './RecommendationFilters'
import { useRecommendationFilters } from './useRecommendationFilters'
import styles from './RecommendationsPage.module.css'

type View =
  | { status: 'loading' }
  | { status: 'error'; kind: ErrorKind }
  | { status: 'ready'; response: RecommendationsResponse }
const PER_PAGE = 9
const MESSAGES = {
  diagnosis_incomplete: 'Completá tu diagnóstico para ver recomendaciones.',
  resale_pending: 'Las recomendaciones por reventa todavía no están disponibles.',
  ready: 'No encontramos vehículos que coincidan con tu diagnóstico.',
}

// High v3 2373:7641; HU07 refines the existing matching results, not a separate catalog.
export default function MatchingRecommendationsPage() {
  const [view, setView] = useState<View>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [page, setPage] = useState(1)
  const { filters, applyFilters } = useRecommendationFilters()
  useEffect(() => {
    let active = true
    fetchRecommendations()
      .then((response) => {
        if (active) setView({ status: 'ready', response })
      })
      .catch((error: unknown) => {
        if (active) setView({ status: 'error', kind: error instanceof NetworkError ? 'network' : 'server' })
      })
    return () => { active = false }
  }, [attempt])

  const response = view.status === 'ready' ? view.response : null
  const results = filterRecommendations(response?.results ?? [], filters)
  const hasFilters = Object.keys(filters).length > 0
  const exchange = response?.exchange_rate
  const quote = exchange?.quote
  return (
    <div className={`${styles.page} ${styles.filterPage}`}>
      <div className={styles.headerRow}>
        <div className={styles.header}>
          <p className={screenStyles.eyebrow}>AUTOS RECOMENDADOS</p>
          <h1 className={styles.title}>Mejores opciones para vos</h1>
          {response?.status === 'ready' ? (
            <p className={styles.subtitle}>Mostrando {results.length} {results.length === 1 ? 'vehículo' : 'vehículos'}</p>
          ) : null}
        </div>
        <Link to="/diagnostico" className={`${buttonStyles.button} ${buttonStyles.secondary} ${styles.adjust}`}>
          AJUSTAR DIAGNÓSTICO
        </Link>
      </div>
      {response?.status === 'ready' ? (
        <RecommendationFilters value={filters} onChange={(next) => {
          applyFilters(next)
          setPage(1)
        }} />
      ) : null}
      <section className={styles.results} aria-label="Resultados">
        {view.status === 'loading' ? <SessionLoading /> : null}
        {view.status === 'error' ? (
          <ErrorState kind={view.kind} onRetry={() => {
            setView({ status: 'loading' })
            setAttempt((value) => value + 1)
          }} />
        ) : null}
        {response?.status === 'ready' ? (
          <div className={styles.subtitle}>
            {quote ? (
              <p>Dólar oficial venta · {quote.source} · {formatPrice(quote.sell)} · {new Date(quote.updated_at).toLocaleString('es-AR')}</p>
            ) : null}
            {!quote || exchange?.stale ? (
              <p role="status" className={alertStyles.warning}>
                {quote ? 'Última cotización disponible: no se pudo actualizar.'
                  : 'Sin cotización disponible: solo evaluamos precios publicados en pesos, sin equivalente en dólares.'}
              </p>
            ) : null}
          </div>
        ) : null}
        {response && results.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyTitle} role="status">{hasFilters && response.status === 'ready'
              ? 'No encontramos vehículos que cumplan estos filtros.' : MESSAGES[response.status]}</p>
            <p className={styles.emptyHint}>{hasFilters && response.status === 'ready'
              ? 'Quitá o limpiá los filtros para volver a ver tus recomendaciones.'
              : 'Ajustá el diagnóstico para buscar otras opciones.'}</p>
          </div>
        ) : null}
        {results.length > 0 ? (
          <>
            <ScrollArea key={page} label="Recomendaciones" fill className={styles.filteredFrame} viewportClassName={styles.gridArea}>
              <ul className={styles.grid} aria-label="Recomendaciones">
                {results.slice((page - 1) * PER_PAGE, page * PER_PAGE).map((result) => (
                  <MatchingVehicleCard key={result.listing_id} result={result} />
                ))}
              </ul>
            </ScrollArea>
            {results.length > PER_PAGE ? (
              <ListFooter>
                <Pagination page={page} lastPage={Math.ceil(results.length / PER_PAGE)} onChange={setPage} />
              </ListFooter>
            ) : null}
          </>
        ) : null}
      </section>
    </div>
  )
}
