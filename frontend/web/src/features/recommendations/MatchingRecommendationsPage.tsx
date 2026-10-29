import { useState } from 'react'
import { Link } from 'react-router'
import { OTHER_PORTALS_TAB, portalCountLabel, portalTabLabel } from '@shared/portals/format'
import { filterRecommendations } from '@shared/recommendations/filters'
import { emptyStateCopy, exchangeRateNotice, vehicleCount } from '@shared/recommendations/format'
import { RECOMMENDATIONS_PER_PAGE as PER_PAGE } from '@shared/recommendations/matching'
import alertStyles from '../../components/alert.module.css'
import buttonStyles from '../../components/button.module.css'
import ErrorState from '../../components/ErrorState'
import ListFooter from '../../components/ListFooter'
import Pagination from '../../components/Pagination'
import ScrollArea from '../../components/ScrollArea'
import screenStyles from '../../components/screen.module.css'
import Tabs from '../../components/Tabs'
import SessionLoading from '../auth/session/SessionLoading'
import ComparisonControls from '../comparison/ComparisonControls'
import { useComparisonSelection } from '../comparison/useComparisonSelection'
import { fetchRecommendations } from './matching'
import MatchingVehicleCard from './MatchingVehicleCard'
import { fetchPortalModels } from './portalModels'
import PortalModelsInfoTip from './PortalModelsInfoTip'
import PortalModelsPanel from './PortalModelsPanel'
import RecommendationFilters from './RecommendationFilters'
import { useApiView } from './useApiView'
import { useRecommendationFilters } from './useRecommendationFilters'
import styles from './RecommendationsPage.module.css'

const DEALERS_TAB = 'dealers'
const PORTALS_TAB = 'portals'

// High v3 2373:7641; HU07 refines the existing matching results, not a separate catalog.
// HU06 adds the "Otros portales" tab; both lists load in parallel, each with its own state.
export default function MatchingRecommendationsPage() {
  const { view, retry } = useApiView(fetchRecommendations)
  const portals = useApiView(fetchPortalModels)
  const [page, setPage] = useState(1)
  const [chosenTab, setChosenTab] = useState<string | null>(null)
  // Whether the first dealers load came back empty; decided once, so the page never switches tabs on its own later.
  const [firstLoadEmpty, setFirstLoadEmpty] = useState<boolean | null>(null)
  const { filters, applyFilters } = useRecommendationFilters()
  const comparison = useComparisonSelection()
  if (firstLoadEmpty === null && view.status === 'ready') setFirstLoadEmpty(view.response.results.length === 0)

  const response = view.status === 'ready' ? view.response : null
  const results = filterRecommendations(response?.results ?? [], filters)
  const hasFilters = Object.keys(filters).length > 0
  const notice = exchangeRateNotice(response?.exchange_rate)
  const empty = response ? emptyStateCopy(response.status, hasFilters) : null
  const portalCount = portals.view.status === 'ready' && portals.view.response.status === 'ready'
    ? portals.view.response.modelos.length : null
  const tabs = [
    { id: DEALERS_TAB, label: 'Concesionarias' },
    { id: PORTALS_TAB, label: portalCount === null ? OTHER_PORTALS_TAB : portalTabLabel(portalCount) },
  ]

  const activeTab = chosenTab ?? (firstLoadEmpty ? PORTALS_TAB : DEALERS_TAB)
  // The count of the active tab, once its list is known; nothing while loading or on error.
  const subtitle = activeTab === PORTALS_TAB
    ? (portalCount === null ? null : portalCountLabel(portalCount))
    : (response?.status === 'ready' ? vehicleCount(results.length) : null)

  const resultsSection = (
    <section className={styles.results} aria-label="Resultados">
      {view.status === 'loading' ? <SessionLoading /> : null}
      {view.status === 'error' ? <ErrorState kind={view.kind} onRetry={retry} /> : null}
      {response?.status === 'ready' ? (
        <div className={styles.notice}>
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
  )

  const dealersPanel = (
    <div className={styles.dealersLayout}>
      {response?.status === 'ready' ? (
        <RecommendationFilters value={filters} actions={<div className={styles.comparison}><ComparisonControls selection={comparison} /></div>}
          onChange={(next) => {
            applyFilters(next)
            setPage(1)
          }}>
          {resultsSection}
        </RecommendationFilters>
      ) : resultsSection}
    </div>
  )

  return (
    <div className={`${styles.page} ${styles.filterPage}`}>
      <div className={styles.headerRow}>
        <div className={styles.header}>
          <p className={screenStyles.eyebrow}>AUTOS RECOMENDADOS</p>
          <h1 className={styles.title}>Mejores opciones para vos</h1>
          {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
        </div>
        <Link to="/diagnostico" className={`${buttonStyles.button} ${buttonStyles.secondary} ${styles.adjust}`}>
          AJUSTAR DIAGNÓSTICO
        </Link>
      </div>
      <Tabs label="Fuentes de recomendaciones" items={tabs} value={activeTab} variant="underline"
        onValueChange={setChosenTab} panelClassName={styles.tabPanel}
        trailing={activeTab === PORTALS_TAB ? <PortalModelsInfoTip view={portals.view} /> : null}>
        {(id) => id === PORTALS_TAB ? <PortalModelsPanel view={portals.view} onRetry={portals.retry} /> : dealersPanel}
      </Tabs>
    </div>
  )
}
