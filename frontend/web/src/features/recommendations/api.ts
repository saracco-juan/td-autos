import { apiFetch } from '../../lib/http'
import type { SearchResponse } from './types'

type SearchParams = {
  /** Free text (brand, model, version); blank means "everything". */
  q?: string
  /** 1-based; the first page is the default and is not sent. */
  page?: number
  /** Items per page; the API caps it at 60 and answers 24 when it is absent. */
  perPage?: number
}

// One page of the unified list of dealer vehicles and integrated marketplaces (RF05). The text is applied by the API on its database.
export function searchListings({ q, page, perPage }: SearchParams = {}): Promise<SearchResponse> {
  const params: string[] = []
  const text = q?.trim()
  if (text) params.push(`q=${encodeURIComponent(text)}`)
  if (page && page > 1) params.push(`page=${page}`)
  if (perPage) params.push(`per_page=${perPage}`)
  const query = params.join('&')
  return apiFetch<SearchResponse>(query ? `/api/busqueda?${query}` : '/api/busqueda')
}
