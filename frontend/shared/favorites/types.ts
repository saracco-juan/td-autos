import type { DetailVehicle } from '../vehicles/detail'

export type FavoriteVehicle = Pick<DetailVehicle,
  'id' | 'marca' | 'modelo' | 'version' | 'anio' | 'precio' | 'moneda'
  | 'kilometraje' | 'transmision' | 'combustible' | 'ubicacion'> & { image_url: string | null }

export type FavoritesResponse = {
  data: FavoriteVehicle[]
  meta: { current_page: number; per_page: number; last_page: number; total: number }
}
