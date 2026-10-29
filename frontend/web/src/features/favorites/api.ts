import type { FavoritesResponse } from '@shared/favorites/types'
import { apiFetch } from '../../lib/http'

export function listFavorites({ page, perPage, ids }: {
  page?: number; perPage?: number; ids?: readonly number[]
} = {}): Promise<FavoritesResponse> {
  const query = new URLSearchParams()
  if (page) query.set('page', String(page))
  if (perPage) query.set('per_page', String(perPage))
  ids?.forEach((id) => query.append('ids[]', String(id)))
  return apiFetch<FavoritesResponse>(`/api/favoritos${query.size ? `?${query}` : ''}`)
}

export function setFavorite(id: number, saved: boolean): Promise<void> {
  return apiFetch<void>(`/api/favoritos/${id}`, { method: saved ? 'PUT' : 'DELETE' })
}
