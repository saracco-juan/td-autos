// Shapes of GET /api/busqueda (RF05): the unified list plus the status of each integrated marketplace.
export type SourceStatus = 'ok' | 'sin_respuesta'

export type Source = {
  clave: string
  nombre: string
}

export type SourceReport = Source & {
  estado: SourceStatus
}

export type Listing = {
  id: number
  titulo: string
  marca: string | null
  modelo: string | null
  version: string | null
  anio: number | null
  kilometraje: number | null
  precio: number | null
  moneda: string | null
  ubicacion: string | null
  imagen_url: string | null
  // Null for a dealer vehicle: it has no original listing.
  url_original: string | null
  fuente: Source
}

export type SearchMeta = {
  page: number
  per_page: number
  total: number
  last_page: number
}

export type SearchResponse = {
  publicaciones: Listing[]
  // The external marketplaces only: dealers are not a portal.
  fuentes: SourceReport[]
  meta: SearchMeta
}
