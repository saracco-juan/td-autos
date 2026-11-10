import type { FavoritesResponse } from './types'

type Request = <T>(path: string, options?: { method: 'PUT' | 'DELETE' }) => Promise<T>

// Both clients supply their existing authenticated transport.
export function createFavoritesApi(request: Request) {
  function listFavorites({ page, perPage, ids }: {
    page?: number; perPage?: number; ids?: readonly number[]
  } = {}): Promise<FavoritesResponse> {
    const query = new URLSearchParams()
    if (page) query.set('page', String(page))
    if (perPage) query.set('per_page', String(perPage))
    ids?.forEach((id) => query.append('ids[]', String(id)))
    return request<FavoritesResponse>(`/api/favoritos${query.size ? `?${query}` : ''}`)
  }

  function setFavorite(id: number, saved: boolean): Promise<void> {
    return request<void>(`/api/favoritos/${id}`, { method: saved ? 'PUT' : 'DELETE' })
  }

  return { listFavorites, setFavorite }
}
