import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import alertStyles from '../../components/alert.module.css'
import buttonStyles from '../../components/button.module.css'
import ErrorState, { type ErrorKind } from '../../components/ErrorState'
import ListFooter from '../../components/ListFooter'
import Pagination from '../../components/Pagination'
import ScrollArea from '../../components/ScrollArea'
import screenStyles from '../../components/screen.module.css'
import { HttpError, NetworkError } from '../../lib/http'
import Field from '../auth/shared/Field'
import SessionLoading from '../auth/session/SessionLoading'
import { searchListings } from './api'
import styles from './RecommendationsPage.module.css'
import type { SearchResponse } from './types'
import VehicleCard from './VehicleCard'

// `query`, `page` and `perPage` are the search the view belongs to, so a retry repeats it.
type View =
  | { status: 'loading'; query?: string; page: number; perPage: number }
  | { status: 'ready'; query?: string; page: number; perPage: number; response: SearchResponse }
  | { status: 'error'; query?: string; page: number; perPage: number; kind: ErrorKind }

// "Mostrar" options: whole rows of the three-column grid, 3 x 3 by default (DESIGN.md). The API accepts up to 60.
const PAGE_SIZES = [9, 18, 27]

const TOO_LONG = 'Usá hasta 100 caracteres.'

function countText(count: number): string {
  return `Mostrando ${count} ${count === 1 ? 'vehículo' : 'vehículos'}`
}

// "A", "A y B", "A, B y C".
function joinNames(names: string[]): string {
  return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`
}

// Recommendations screen (Figma 38:168, UH-06): dealer vehicles and external listings in one paginated list, which HU05 later ranks.
// Match percentage, COMPARAR, VER FICHA and the filter sidebar wait for their own stories. The search runs on Enter, as in Figma.
export default function RecommendationsPage() {
  const [view, setView] = useState<View>({ status: 'loading', page: 1, perPage: PAGE_SIZES[0] })
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0])
  const [draft, setDraft] = useState('')
  const [fieldError, setFieldError] = useState<string[] | undefined>()
  // Only the last request may answer: a slower, older one is dropped.
  const latest = useRef(0)

  // `previous` is the view to go back to when the text is rejected (422), so the list stays on screen.
  const fetchListings = useCallback((query: string | undefined, page: number, perPage: number, previous: View | null) => {
    latest.current += 1
    const request = latest.current
    searchListings({ q: query, page, perPage })
      .then((response) => {
        if (request === latest.current) setView({ status: 'ready', query, page, perPage, response })
      })
      .catch((error: unknown) => {
        if (request !== latest.current) return
        if (previous && error instanceof HttpError && error.status === 422) {
          setView(previous)
          setFieldError([TOO_LONG])
          return
        }
        setView({ status: 'error', query, page, perPage, kind: error instanceof NetworkError ? 'network' : 'server' })
      })
  }, [])

  useEffect(() => {
    fetchListings(undefined, 1, PAGE_SIZES[0], null)
    return () => {
      latest.current += 1
    }
  }, [fetchListings])

  // The list is replaced by the loader while it loads, so the scroll area comes back at the top.
  const search = (query: string | undefined, page: number, previous: View | null, size = pageSize) => {
    setFieldError(undefined)
    setView({ status: 'loading', query, page, perPage: size })
    fetchListings(query, page, size, previous)
  }

  // A new page size starts again on the first page of the same search.
  const changePageSize = (size: number) => {
    setPageSize(size)
    search(view.query, 1, null, size)
  }

  const loading = view.status === 'loading'

  // A new search always starts on the first page.
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (loading) return
    search(draft.trim() || undefined, 1, view)
  }

  const response = view.status === 'ready' ? view.response : null
  const failed = response?.fuentes.filter((source) => source.estado === 'sin_respuesta') ?? []
  // The error state is only for "nothing to show": every portal failed and there is no dealer vehicle either.
  // With results, the list stays and the notice names the failed portals.
  const hasResults = response !== null && response.meta.total > 0
  const allFailed = response !== null && response.fuentes.length > 0 && failed.length === response.fuentes.length
  const noResultsAndAllFailed = response !== null && !hasResults && allFailed
  const listings = response && !noResultsAndAllFailed ? response.publicaciones : null

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div className={styles.header}>
          <p className={screenStyles.eyebrow}>AUTOS RECOMENDADOS</p>
          <h1 className={styles.title}>Mejores opciones para vos</h1>
          {response && listings ? <p className={styles.subtitle}>{countText(response.meta.total)}</p> : null}
        </div>
        <Link to="/diagnostico" className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.soft} ${styles.adjust}`}>
          AJUSTAR DIAGNÓSTICO
        </Link>
      </div>
      <form role="search" onSubmit={handleSubmit} noValidate className={styles.search}>
        <Field id="listing-search" label="Buscar por marca, modelo o versión" errors={fieldError}>
          {(control) => (
            <input
              {...control}
              type="search"
              name="q"
              autoComplete="off"
              enterKeyHint="search"
              placeholder="Ej: Corolla automático 2021"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
          )}
        </Field>
      </form>
      <section className={styles.results} aria-label="Resultados">
        {loading ? <SessionLoading /> : null}
        {view.status === 'error' ? (
          <ErrorState kind={view.kind} onRetry={() => search(view.query, view.page, null)} />
        ) : null}
        {noResultsAndAllFailed ? <ErrorState kind="sources" onRetry={() => search(view.query, 1, null)} /> : null}
        {listings ? (
          <>
            {failed.length > 0 ? (
              <p role="status" className={alertStyles.warning}>
                No pudimos obtener las publicaciones de {joinNames(failed.map((source) => source.nombre))}. Te mostramos las
                del resto de los portales.
              </p>
            ) : null}
            {listings.length === 0 ? (
              <div className={styles.empty}>
                <p className={styles.emptyTitle}>No encontramos publicaciones para tu búsqueda.</p>
                {view.query ? <p className={styles.emptyHint}>Probá con otra marca, modelo o versión.</p> : null}
              </div>
            ) : (
              <>
                <ScrollArea label="Publicaciones" fill viewportClassName={styles.gridArea}>
                  <ul className={styles.grid} aria-label="Publicaciones">
                    {listings.map((listing) => (
                      <VehicleCard key={listing.id} listing={listing} />
                    ))}
                  </ul>
                </ScrollArea>
                {/* With "Mostrar" the pager stays while more listings than the smallest page exist, even on a single page. */}
                {response && response.meta.total > PAGE_SIZES[0] ? (
                  <ListFooter>
                    <Pagination
                      page={response.meta.page}
                      lastPage={response.meta.last_page}
                      onChange={(page) => search(view.query, page, null)}
                      pageSize={pageSize}
                      pageSizeOptions={PAGE_SIZES}
                      onPageSizeChange={changePageSize}
                    />
                  </ListFooter>
                ) : null}
              </>
            )}
          </>
        ) : null}
      </section>
    </div>
  )
}
