import { useEffect, useState } from 'react'
import { Link } from 'react-router'
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
  const [matches, setMatches] = useState<Recommendation[]>([])
  useEffect(() => {
    let active = true
    fetchRecommendations().then((response) => {
      if (active && response.status === 'ready') setMatches(response.results)
    }).catch(() => { /* Matching is optional; saved vehicles remain usable without it. */ })
    return () => { active = false }
  }, [])
  const { view, items, total, page, perPage, lastPage, pendingIds, actionError, removed } = favorites
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
        {total > 0 ? <div className={styles.headerActions} role="group" aria-label="Acciones de favoritos">
          {recommendationsLink}
          {view.status === 'ready' ? <ComparisonControls className={styles.comparison} selection={comparison} source="favorites"
            vehicles={items.map((vehicle) => ({ id: vehicle.id,
              label: `${vehicle.marca} ${vehicle.modelo} ${vehicle.anio}`,
              title: [vehicle.marca, vehicle.modelo, vehicle.version, vehicle.anio].filter(Boolean).join(' '), image: vehicle.image_url }))} /> : null}
        </div> : null}
      </header>
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
            onToggle={comparison.toggle}
            onRemove={favorites.remove} />
        ) : null}
        {total > PAGE_SIZES[0] ? (
          <ListFooter>
            <div className={styles.pager}>
              <Pagination page={page} lastPage={lastPage} onChange={favorites.setPage} />
              <label className={styles.pageSize}>Mostrar
                <select aria-label="Mostrar" value={perPage} onChange={(event) => favorites.changePageSize(Number(event.target.value))}>
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
