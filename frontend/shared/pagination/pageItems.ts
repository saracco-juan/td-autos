export type PageItem = number | 'start-ellipsis' | 'end-ellipsis'

const BOUNDARY_COUNT = 1

const range = (from: number, to: number): number[] =>
  Array.from({ length: Math.max(to - from + 1, 0) }, (_, index) => from + index)

// Same page window as MUI's Pagination: first and last page always, siblings around the current one, "…" for the gaps.
export function buildPageItems(page: number, lastPage: number, siblingCount: number): PageItem[] {
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

  const startGap: PageItem[] =
    siblingsStart > BOUNDARY_COUNT + 2
      ? ['start-ellipsis']
      : BOUNDARY_COUNT + 1 < lastPage - BOUNDARY_COUNT
        ? [BOUNDARY_COUNT + 1]
        : []
  const endGap: PageItem[] =
    siblingsEnd < lastPage - BOUNDARY_COUNT - 1
      ? ['end-ellipsis']
      : lastPage - BOUNDARY_COUNT > BOUNDARY_COUNT
        ? [lastPage - BOUNDARY_COUNT]
        : []

  return [...startPages, ...startGap, ...range(siblingsStart, siblingsEnd), ...endGap, ...endPages]
}
