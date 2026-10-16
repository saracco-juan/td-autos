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
  url_original: string
  fuente: Source
}

export type SearchResponse = {
  publicaciones: Listing[]
  fuentes: SourceReport[]
}
