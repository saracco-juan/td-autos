import { useEffect, useState } from 'react'
import styles from './Pagination.module.css'

type PaginationProps = {
  page: number
  lastPage: number
  onChange: (page: number) => void
  /** Pages shown on each side of the current one. Defaults to 1, or 0 on small screens. */
  siblingCount?: number
}

type Item = number | 'start-ellipsis' | 'end-ellipsis'

const BOUNDARY_COUNT = 1
const COMPACT_QUERY = '(max-width: 600px)'

const range = (from: number, to: number): number[] =>
  Array.from({ length: Math.max(to - from + 1, 0) }, (_, index) => from + index)

// Same page window as MUI's Pagination: first and last page always, siblings around the current one, "…" for the gaps.
function buildItems(page: number, lastPage: number, siblingCount: number): Item[] {
  const startPages = range(1, Math.min(BOUNDARY_COUNT, lastPage))
  const endPages = range(Math.max(lastPage - BOUNDARY_COUNT + 1, BOUNDARY_COUNT + 1), lastPage)

  const siblingsStart = Math.max(
    Math.min(page - siblingCount, lastPage - BOUNDARY_COUNT - siblingCount * 2 - 1),
    BOUNDARY_COUNT + 2,
  )
  const siblingsEnd = Math.min(
    Math.max(page + siblingCount, BOUNDARY_COUNT + siblingCount * 2 + 2),
    endPages.length > 0 ? endPages[0] - 2 : lastPage - 1,
  )

  const startGap: Item[] =
    siblingsStart > BOUNDARY_COUNT + 2
      ? ['start-ellipsis']
      : BOUNDARY_COUNT + 1 < lastPage - BOUNDARY_COUNT
        ? [BOUNDARY_COUNT + 1]
        : []
  const endGap: Item[] =
    siblingsEnd < lastPage - BOUNDARY_COUNT - 1
      ? ['end-ellipsis']
      : lastPage - BOUNDARY_COUNT > BOUNDARY_COUNT
        ? [lastPage - BOUNDARY_COUNT]
        : []

  return [...startPages, ...startGap, ...range(siblingsStart, siblingsEnd), ...endGap, ...endPages]
}

// Phones get no siblings so the control fits one line.
function useCompact(): boolean {
  const matcher = () =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(COMPACT_QUERY) : null
  const [compact, setCompact] = useState(() => matcher()?.matches ?? false)

  useEffect(() => {
    const query = matcher()
    if (!query) return
    const update = () => setCompact(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  return compact
}

function Arrow({ direction }: { direction: 'previous' | 'next' }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        d={direction === 'previous' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// Numbered page control for lists (D9, DESIGN.md), styled after MUI's Pagination. See the "Figma sync" table of UH-06.
export default function Pagination({ page, lastPage, onChange, siblingCount }: PaginationProps) {
  const compact = useCompact()
  const items = buildItems(page, lastPage, siblingCount ?? (compact ? 0 : 1))

  return (
    <nav aria-label="Paginación" className={styles.pagination}>
      <button
        type="button"
        aria-label="Página anterior"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className={styles.item}
      >
        <Arrow direction="previous" />
      </button>
      <ul className={styles.pages}>
        {items.map((item) =>
          typeof item === 'number' ? (
            <li key={item}>
              <button
                type="button"
                aria-label={`Página ${item}`}
                aria-current={item === page ? 'page' : undefined}
                onClick={() => {
                  if (item !== page) onChange(item)
                }}
                className={styles.item}
              >
                {item}
              </button>
            </li>
          ) : (
            <li key={item} className={styles.ellipsis}>
              …
            </li>
          ),
        )}
      </ul>
      <button
        type="button"
        aria-label="Página siguiente"
        disabled={page >= lastPage}
        onClick={() => onChange(page + 1)}
        className={styles.item}
      >
        <Arrow direction="next" />
      </button>
    </nav>
  )
}
