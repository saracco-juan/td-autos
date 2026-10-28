import type { ExchangeRate } from '../recommendations/matching'

// GET /api/recomendaciones/modelos (HU06), shared by web and mobile. The backend builds the portal search links;
// nothing here knows how a portal URL is made.
export type PortalLink = { portal: string; nombre: string; url: string }

/** Credited photo of the model (Wikimedia Commons); `pagina` is the file page that holds the license. */
export type PortalPhoto = { url: string; autor: string; licencia: string; pagina: string }

export type PortalModel = {
  id: number
  /** Catalog brand, uppercase (TOYOTA). */
  marca: string
  modelo: string
  carroceria: string | null
  anios: { desde: number; hasta: number }
  /** Cheapest and dearest version of the newest fitting year, in whole pesos. */
  precio: { desde_ars: number; hasta_ars: number; anio_referencia: number }
  motivos: string[]
  /** The filters the Mercado Libre link applies, ready to show as chips. */
  filtros: string[]
  links: PortalLink[]
  imagen: PortalPhoto | null
}

export type PortalModelsStatus = 'ready' | 'diagnosis_incomplete'

export type PortalPriceSource = { nombre: string; fecha: string }

export type PortalModelsResponse = {
  status: PortalModelsStatus
  modelos: PortalModel[]
  fuente_precios: PortalPriceSource | null
  exchange_rate?: ExchangeRate | null
}

export const PORTAL_MODELS_PATH = '/api/recomendaciones/modelos'
