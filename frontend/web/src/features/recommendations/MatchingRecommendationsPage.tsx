import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { filterRecommendations } from '@shared/recommendations/filters'
import { emptyStateCopy, exchangeRateNotice, vehicleCount } from '@shared/recommendations/format'
import { RECOMMENDATIONS_PER_PAGE as PER_PAGE } from '@shared/recommendations/matching'
import alertStyles from '../../components/alert.module.css'
import buttonStyles from '../../components/button.module.css'
import ErrorState, { type ErrorKind } from '../../components/ErrorState'
import ListFooter from '../../components/ListFooter'
import Pagination from '../../components/Pagination'
import ScrollArea from '../../components/ScrollArea'
import screenStyles from '../../components/screen.module.css'
import { NetworkError } from '../../lib/http'
import SessionLoading from '../auth/session/SessionLoading'
import ComparisonControls from '../comparison/ComparisonControls'
import { useComparisonSelection } from '../comparison/useComparisonSelection'
import { fetchRecommendations, type RecommendationsResponse } from './matching'
import MatchingVehicleCard from './MatchingVehicleCard'
import RecommendationFilters from './RecommendationFilters'
import { useRecommendationFilters } from './useRecommendationFilters'
import styles from './RecommendationsPage.module.css'

type View =
  | { status: 'loading' }
  | { status: 'error'; kind: ErrorKind }
  | { status: 'ready'; response: RecommendationsResponse }

// High v3 2373:7641; HU07 refines the existing matching results, not a separate catalog.
export default function MatchingRecommendationsPage() {
  const [view, setView] = useState<View>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [page, setPage] = useState(1)
  const { filters, applyFilters } = useRecommendationFilters()
  const comparison = useComparisonSelection()
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
  const notice = exchangeRateNotice(response?.exchange_rate)
  const empty = response ? emptyStateCopy(response.status, hasFilters) : null
  return (
    <div className={`${styles.page} ${styles.filterPage}`}>
      <div className={styles.headerRow}>
        <div className={styles.header}>
          <p className={screenStyles.eyebrow}>AUTOS RECOMENDADOS</p>
          <h1 className={styles.title}>Mejores opciones para vos</h1>
          {response?.status === 'ready' ? (
            <p className={styles.subtitle}>{vehicleCount(results.length)}</p>
          ) : null}
          {response?.status === 'ready' ? <ComparisonControls selection={comparison} /> : null}
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
            {notice.summary ? <p>{notice.summary}</p> : null}
            {notice.warning ? <p role="status" className={alertStyles.warning}>{notice.warning}</p> : null}
          </div>
        ) : null}
        {empty && results.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyTitle} role="status">{empty.title}</p>
            <p className={styles.emptyHint}>{empty.hint}</p>
          </div>
        ) : null}
        {results.length > 0 ? (
          <>
            <ScrollArea key={page} label="Recomendaciones" fill className={styles.filteredFrame} viewportClassName={styles.gridArea}>
              <ul className={styles.grid} aria-label="Recomendaciones">
                {results.slice((page - 1) * PER_PAGE, page * PER_PAGE).map((result) => (
                  <MatchingVehicleCard key={result.listing_id} result={result} comparison={{
                    selected: comparison.ids.includes(result.listing_id), toggle: () => comparison.toggle(result.listing_id),
                  }} />
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
