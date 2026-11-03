import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import alertStyles from '../../components/alert.module.css'
import buttonStyles from '../../components/button.module.css'
import ErrorState from '../../components/ErrorState'
import ListFooter from '../../components/ListFooter'
import Pagination from '../../components/Pagination'
import screenStyles from '../../components/screen.module.css'
import SessionLoading from '../auth/session/SessionLoading'
import { fetchRecommendations, type Recommendation } from '../recommendations/matching'
import FavoritesCarousel from './FavoritesCarousel'
import styles from './FavoritesPage.module.css'
import { useFavoritesList } from './useFavoritesList'
import ComparisonControls from '../comparison/ComparisonControls'
import { useComparisonSelection } from '../comparison/useComparisonSelection'

const PAGE_SIZES = [6, 12, 24]

export default function FavoritesPage() {
  const favorites = useFavoritesList()
  const comparison = useComparisonSelection()
  const navigate = useNavigate()
  const [pendingComparison, setPendingComparison] = useState<string | null>(null)
  const [matches, setMatches] = useState<Recommendation[]>([])
  useEffect(() => {
    let active = true
    fetchRecommendations().then((response) => {
      if (active && response.status === 'ready') setMatches(response.results)
    }).catch(() => { /* Matching is optional; saved vehicles remain usable without it. */ })
    return () => { active = false }
  }, [])
  const { view, items, total, page, perPage, lastPage, pendingIds, actionError, removed } = favorites
  const selectionKey = comparison.ids.join(',')
  const comparisonSearch = comparison.search.toString()
  const openComparison = useCallback(() => {
    if (!pendingComparison || pendingComparison !== selectionKey || view.status !== 'ready') return
    const params = new URLSearchParams(comparisonSearch)
    params.set('source', 'favorites')
    setPendingComparison(null)
    navigate(`/comparar?${params}`)
  }, [pendingComparison, selectionKey, view.status, comparisonSearch, navigate])
  useEffect(() => {
    if (!pendingComparison || pendingComparison !== selectionKey || view.status !== 'ready') return
    // Transition events can be skipped when the browser interrupts motion.
    const timer = window.setTimeout(openComparison, 700)
    return () => window.clearTimeout(timer)
  }, [pendingComparison, selectionKey, view.status, openComparison])
  const toggleComparison = (id: number) => {
    if (comparison.ids.includes(id)) setPendingComparison(null)
    else if (comparison.ids.length === 1) setPendingComparison([...comparison.ids, id].join(','))
    comparison.toggle(id)
  }
  useEffect(() => {
    if (removed && comparison.ids.includes(removed.vehicle.id)) comparison.toggle(removed.vehicle.id)
  }, [removed, comparison])
  const recommendationsLink = <Link to="/recomendaciones" className={`${buttonStyles.button} ${buttonStyles.secondary} ${styles.footerAction}`}>
    VER RECOMENDADOS
  </Link>
  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <p className={screenStyles.eyebrow}>FAVORITOS</p>
          <h1 className={screenStyles.title}>Vehículos guardados</h1>
          <p className={styles.subtitle}>{total === 0 ? 'Sin vehículos guardados'
            : `${total} ${total === 1 ? 'vehículo guardado' : 'vehículos guardados'}`}</p>
        </div>
        {total > 0 ? recommendationsLink : null}
      </header>
      {view.status === 'ready' && total > 0 ? <div className={styles.comparison}>
        <ComparisonControls selection={{ ...comparison, toggle: toggleComparison }} source="favorites" />
      </div> : null}
      {actionError ? (
        <p role="alert" className={alertStyles.alert}>
          No pudimos actualizar tus favoritos. Intentá nuevamente.
          <button type="button" className={styles.retryAction} onClick={favorites.retryAction}>REINTENTAR</button>
        </p>
      ) : null}
      {removed ? (
        <div role="status" className={styles.toast}>
          <span>Quitaste {removed.vehicle.marca} {removed.vehicle.modelo} {removed.vehicle.version} {removed.vehicle.anio} de tus favoritos.</span>
          <button type="button" className={styles.undo} disabled={pendingIds.includes(removed.vehicle.id)}
            aria-busy={pendingIds.includes(removed.vehicle.id)} onClick={favorites.undo}>Deshacer</button>
        </div>
      ) : null}
      <div className={styles.list}>
        {view.status === 'loading' ? <SessionLoading /> : null}
        {view.status === 'error' ? <ErrorState kind={view.kind} onRetry={favorites.retry} /> : null}
        {view.status === 'ready' && total === 0 ? (
          <div className={styles.empty}>
            <h2>Todavía no guardaste vehículos</h2>
            <p>Guardá los que te interesen desde Recomendaciones y encontralos acá.</p>
            <Link to="/recomendaciones" className={`${buttonStyles.button} ${buttonStyles.secondary} ${styles.recommendations}`}>
              VER RECOMENDADOS
            </Link>
          </div>
        ) : null}
        {view.status === 'ready' && items.length > 0 ? (
          <FavoritesCarousel key={`${page}-${perPage}`} items={items} matches={matches}
            selectedIds={comparison.ids} pendingIds={pendingIds}
            onToggle={toggleComparison}
            onRemove={(vehicle) => { setPendingComparison(null); void favorites.remove(vehicle) }}
            onSelectionSettled={(id) => { if (comparison.ids.at(-1) === id) openComparison() }} />
        ) : null}
        {total > PAGE_SIZES[0] ? (
          <ListFooter>
            <div className={styles.pager}>
              <Pagination page={page} lastPage={lastPage} onChange={(nextPage) => { setPendingComparison(null); favorites.setPage(nextPage) }} />
              <label className={styles.pageSize}>Mostrar
                <select aria-label="Mostrar" value={perPage} onChange={(event) => { setPendingComparison(null); favorites.changePageSize(Number(event.target.value)) }}>
                  {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
                </select>
              </label>
            </div>
          </ListFooter>
        ) : null}
      </div>
    </section>
  )
}
