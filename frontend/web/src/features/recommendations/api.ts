import { apiFetch } from '../../lib/http'
import type { SearchResponse } from './types'

type SearchParams = {
  /** Free text (brand, model, version); blank means "everything". */
  q?: string
  /** 1-based; the first page is the default and is not sent. */
  page?: number
}

// One page of the unified list of dealer vehicles and integrated marketplaces (RF05). The text is applied by the API on its database.
export function searchListings({ q, page }: SearchParams = {}): Promise<SearchResponse> {
  const params: string[] = []
  const text = q?.trim()
  if (text) params.push(`q=${encodeURIComponent(text)}`)
  if (page && page > 1) params.push(`page=${page}`)
  const query = params.join('&')
  return apiFetch<SearchResponse>(query ? `/api/busqueda?${query}` : '/api/busqueda')
}
