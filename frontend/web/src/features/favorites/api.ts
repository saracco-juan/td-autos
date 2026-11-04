import { createFavoritesApi } from '@shared/favorites/api'
import { apiFetch } from '../../lib/http'

export const { listFavorites, setFavorite } = createFavoritesApi(apiFetch)
