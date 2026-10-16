import { apiFetch } from '../../lib/http'
import type { SearchResponse } from './types'

// Unified list of the integrated marketplaces (RF05). The text is free (brand, model, version); a blank one means "everything".
export function searchListings(text?: string): Promise<SearchResponse> {
  const query = text?.trim()
  return apiFetch<SearchResponse>(query ? `/api/busqueda?q=${encodeURIComponent(query)}` : '/api/busqueda')
}
