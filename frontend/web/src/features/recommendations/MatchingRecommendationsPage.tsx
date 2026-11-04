import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { OTHER_PORTALS_TAB, portalCountLabel, portalTabLabel } from '@shared/portals/format'
import { filterRecommendations } from '@shared/recommendations/filters'
import { DIAGNOSIS_STEPS } from '@shared/diagnosis/steps'
import { emptyStateCopy, exchangeRateNotice, vehicleCount, recommendationTitle } from '@shared/recommendations/format'
import { RECOMMENDATIONS_PER_PAGE as PER_PAGE } from '@shared/recommendations/matching'
import alertStyles from '../../components/alert.module.css'
import buttonStyles from '../../components/Buttons/button.module.css'
import ErrorState from '../../components/ErrorState'
import Pagination from '../../components/Pagination'
import Tabs from '../../components/Tabs'
import SessionLoading from '../auth/session/SessionLoading'
import ComparisonControls from '../comparison/ComparisonControls'
import { useComparisonSelection } from '../comparison/useComparisonSelection'
import { fetchDiagnosis } from '../diagnosis/api'
import { fetchRecommendations } from './matching'
import MatchingVehicleCard from './MatchingVehicleCard'
import ExchangeRateCaption from './ExchangeRateCaption'
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
  const diagnosis = useApiView(fetchDiagnosis)
  const priority = diagnosis.view.status === 'ready' ? diagnosis.view.response.diagnostico?.prioridad : undefined
  const usage = diagnosis.view.status === 'ready' ? diagnosis.view.response.diagnostico?.uso_principal : undefined
  const usageStep = DIAGNOSIS_STEPS.find((step) => step.field === 'uso_principal')
  const usageLabel = usageStep?.kind === 'single'
    ? usageStep.options.find((option) => option.code === usage)?.label : undefined
  const priorityStep = DIAGNOSIS_STEPS.find((step) => step.field === 'prioridad')
  const priorityLabel = priorityStep?.kind === 'single'
    ? priorityStep.options.find((option) => option.code === priority)?.label : undefined
  const [page, setPage] = useState(1)
  const title = useRef<HTMLHeadingElement>(null)
  const previousPage = useRef(page)
  const [chosenTab, setChosenTab] = useState<string | null>(null)
  // Whether the first dealers load came back empty; decided once, so the page never switches tabs on its own later.
  const [firstLoadEmpty, setFirstLoadEmpty] = useState<boolean | null>(null)
  const { filters, applyFilters } = useRecommendationFilters()
  const comparison = useComparisonSelection()
  useEffect(() => {
    if (previousPage.current !== page) title.current?.scrollIntoView?.({ block: 'start' })
    previousPage.current = page
  }, [page])
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
      {response?.status === 'ready' && notice.warning ? (
        <div className={styles.notice}>
          <p role="status" className={alertStyles.warning}>{notice.warning}</p>
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
          <ul className={styles.grid} aria-label="Recomendaciones">
            {results.slice((page - 1) * PER_PAGE, page * PER_PAGE).map((result) => (
              <MatchingVehicleCard key={result.listing_id} result={result} priorityLabel={priorityLabel} usageLabel={usageLabel} comparison={{
                selected: comparison.ids.includes(result.listing_id), toggle: () => comparison.toggle(result.listing_id),
              }} />
            ))}
          </ul>
          {results.length > PER_PAGE ? (
            <div className={styles.pager}>
              <span>Página {page} de {Math.ceil(results.length / PER_PAGE)}</span>
              <Pagination page={page} lastPage={Math.ceil(results.length / PER_PAGE)} onChange={setPage} />
            </div>
          ) : null}
        </>
      ) : null}
      {response?.status === 'ready' ? <ExchangeRateCaption quote={response.exchange_rate?.quote} /> : null}
    </section>
  )

  const dealersPanel = (
    <div className={styles.dealersLayout}>
      {response?.status === 'ready' ? (
        <RecommendationFilters value={filters} actions={<div className={styles.comparison}><ComparisonControls selection={comparison}
          vehicles={(response.results ?? []).map((result) => ({ id: result.listing_id, title: recommendationTitle(result),
            label: `${result.vehicle.marca} ${result.vehicle.modelo} ${result.vehicle.anio}`,
            image: result.vehicle.image_urls?.[0] ?? result.vehicle.image_url }))} /></div>}
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
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div className={styles.header}>
          <h1 ref={title} className={styles.title}>Mejores opciones para vos</h1>
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
