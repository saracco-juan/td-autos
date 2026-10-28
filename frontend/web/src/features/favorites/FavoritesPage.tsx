import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import alertStyles from '../../components/alert.module.css'
import buttonStyles from '../../components/button.module.css'
import ErrorState from '../../components/ErrorState'
import ListFooter from '../../components/ListFooter'
import Pagination from '../../components/Pagination'
import ScrollArea from '../../components/ScrollArea'
import screenStyles from '../../components/screen.module.css'
import SessionLoading from '../auth/session/SessionLoading'
import { fetchRecommendations, type Recommendation } from '../recommendations/matching'
import FavoriteCard from './FavoriteCard'
import styles from './FavoritesPage.module.css'
import { useFavoritesList } from './useFavoritesList'

const PAGE_SIZES = [6, 12, 24]

export default function FavoritesPage() {
  const favorites = useFavoritesList()
  const [matches, setMatches] = useState<Recommendation[]>([])
  useEffect(() => {
    let active = true
    fetchRecommendations().then((response) => {
      if (active && response.status === 'ready') setMatches(response.results)
    }).catch(() => { /* Matching is optional; saved vehicles remain usable without it. */ })
    return () => { active = false }
  }, [])
  const { view, items, total, page, perPage, lastPage, pendingIds, actionError, removed } = favorites
  const recommendationsLink = <Link to="/recomendaciones" className={`${buttonStyles.button} ${buttonStyles.secondary} ${styles.footerAction}`}>
    VER RECOMENDADOS
  </Link>
  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <p className={screenStyles.eyebrow}>FAVORITOS</p>
        <h1 className={screenStyles.title}>Vehículos guardados</h1>
        <p className={styles.subtitle}>{total === 0 ? 'Sin vehículos guardados'
          : `${total} ${total === 1 ? 'vehículo guardado' : 'vehículos guardados'}`}</p>
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
          <>
            <ScrollArea key={`${page}-${perPage}`} label="Favoritos" fill className={styles.frame} viewportClassName={styles.gridArea}>
              <ul className={styles.grid}>
                {items.map((vehicle) => <FavoriteCard key={vehicle.id} vehicle={vehicle}
                  score={matches.find((match) => match.listing_id === vehicle.id)?.score}
                  bestMatch={matches[0]?.listing_id === vehicle.id}
                  busy={pendingIds.includes(vehicle.id)} onRemove={() => void favorites.remove(vehicle)} />)}
              </ul>
            </ScrollArea>
          </>
        ) : null}
        {total > 0 ? (
          <ListFooter actions={total > PAGE_SIZES[0] ? recommendationsLink : undefined}>
            {total > PAGE_SIZES[0] ? (
                <div className={styles.pager}>
                  <Pagination page={page} lastPage={lastPage} onChange={favorites.setPage} />
                  <label className={styles.pageSize}>Mostrar
                    <select aria-label="Mostrar" value={perPage} onChange={(event) => favorites.changePageSize(Number(event.target.value))}>
                      {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
                    </select>
                  </label>
                </div>
            ) : recommendationsLink}
          </ListFooter>
        ) : null}
      </div>
    </section>
  )
}
