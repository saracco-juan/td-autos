import type { Listing, SearchMeta, SearchResponse, SourceReport } from './types'

export const EXTERNAL_PORTAL = { clave: 'portal-externo', nombre: 'Portal externo' }
export const DEALER = { clave: 'concesionaria', nombre: 'Autos del Sur' }

export function listing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: 1,
    titulo: 'Toyota Corolla XEI 2.0 CVT 2021',
    marca: 'Toyota',
    modelo: 'Corolla',
    version: 'XEI',
    anio: 2021,
    kilometraje: 62000,
    precio: 28900000,
    moneda: 'ARS',
    ubicacion: 'CABA',
    imagen_url: 'https://example.test/listings/1',
    url_original: 'https://example.test/listings/1',
    fuente: EXTERNAL_PORTAL,
    ...overrides,
  }
}

export function sourceReport(overrides: Partial<SourceReport> = {}): SourceReport {
  return { ...EXTERNAL_PORTAL, estado: 'ok', ...overrides }
}

export const LISTINGS: Listing[] = [
  listing(),
  listing({
    id: 2,
    titulo: 'Fiat Cronos Drive 1.3 2022',
    marca: 'Fiat',
    modelo: 'Cronos',
    version: 'Drive',
    anio: 2022,
    kilometraje: 41500,
    precio: 19750000,
    ubicacion: 'Rosario',
    imagen_url: null,
  }),
  listing({
    id: 3,
    titulo: 'Peugeot 208 Allure 2021',
    marca: 'Peugeot',
    modelo: '208',
    version: 'Allure',
    anio: 2021,
    kilometraje: 55000,
    precio: 22300000,
    ubicacion: 'La Plata',
  }),
]

export function searchMeta(overrides: Partial<SearchMeta> = {}): SearchMeta {
  return { page: 1, per_page: 24, total: LISTINGS.length, last_page: 1, ...overrides }
}

// The meta follows the listings of the response unless it is given: one page holding all of them.
export function searchResponse(overrides: Partial<SearchResponse> = {}): SearchResponse {
  const publicaciones = overrides.publicaciones ?? LISTINGS
  return {
    publicaciones,
    fuentes: [sourceReport()],
    meta: searchMeta({ total: publicaciones.length }),
    ...overrides,
  }
}
