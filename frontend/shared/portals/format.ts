import { formatPrice } from '../recommendations/format'
import type { PortalLink, PortalModel, PortalPhoto, PortalPriceSource } from './models'

export const OTHER_PORTALS_TAB = 'Otros portales'
export const PORTAL_MODELS_NOTICE = 'Estos son modelos, no unidades en venta: la foto es ilustrativa. Elegí un portal y te llevamos a la búsqueda ya armada para que veas las unidades reales.'
export const PORTAL_PHOTO_PILL = 'Foto ilustrativa'
export const PORTAL_DETAILS_SUMMARY = 'Ver motivos y filtros'
export const PORTAL_FILTERS_HEADING = 'Filtros que aplicamos en Mercado Libre'
export const PORTAL_KAVAK_NOTE = 'Las unidades y sus precios reales son del portal. En Kavak aplicamos solo la transmisión.'
export const PORTAL_CREDITS_SUMMARY = 'Créditos de las fotos'
export const PORTAL_CREDITS_SOURCE = 'Wikimedia Commons'
export const PORTAL_EMPTY_COPY = {
  title: 'No encontramos modelos para tu diagnóstico.',
  hint: 'Probá ajustando el presupuesto o la carrocería.',
}

// Brands that are initials, not words.
const ACRONYM_BRANDS = new Set(['BMW', 'MG', 'BYD', 'DS', 'GWM', 'JAC', 'DFSK'])

// The catalog stores brands in uppercase; words are split on spaces and hyphens.
export function titleCaseBrand(brand: string): string {
  if (ACRONYM_BRANDS.has(brand.toUpperCase())) return brand.toUpperCase()
  return brand.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, separator: string, letter: string) => separator + letter.toUpperCase())
}

export function portalModelTitle({ marca, modelo }: Pick<PortalModel, 'marca' | 'modelo'>): string {
  return `${titleCaseBrand(marca)} ${modelo}`
}

export function portalYearsLabel({ desde, hasta }: PortalModel['anios']): string {
  return desde === hasta ? `Modelo ${desde}` : `Modelos ${desde}–${hasta}`
}

export function portalPriceRange({ desde_ars, hasta_ars }: PortalModel['precio']): string {
  return `${formatPrice(desde_ars)} – ${formatPrice(hasta_ars)}`
}

export function portalPriceYear({ anio_referencia }: PortalModel['precio']): string {
  return `Precio de referencia del modelo ${anio_referencia}`
}

// The page subtitle while the portals tab is active.
export function portalCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'modelo recomendado' : 'modelos recomendados'}`
}

// The count appears once the models are known.
export function portalTabLabel(count: number | null): string {
  if (count === null) return OTHER_PORTALS_TAB
  return `${OTHER_PORTALS_TAB} · ${count} ${count === 1 ? 'modelo' : 'modelos'}`
}

// Plain string handling: new Date('2026-10-19') would shift the day in negative-offset timezones.
export function portalSourceLabel({ nombre, fecha }: PortalPriceSource): string {
  const [year, month, day] = fecha.split('-')
  return `Precios de referencia: ${nombre}, ${day}/${month}/${year}`
}

// The attribution the photo license asks for, listed per model; the file page it links to holds the license text.
export function portalPhotoCredit(model: Pick<PortalModel, 'marca' | 'modelo'>, { autor, licencia }: PortalPhoto): string {
  return `${portalModelTitle(model)}: ${autor} · ${licencia}`
}

export function portalButtonLabel({ nombre }: Pick<PortalLink, 'nombre'>): string {
  return `VER EN ${nombre.toUpperCase()}`
}

export function portalLinkName(link: Pick<PortalLink, 'nombre'>, model: Pick<PortalModel, 'marca' | 'modelo'>): string {
  return `${portalButtonLabel(link)}: ${portalModelTitle(model)} (se abre en una pestaña nueva)`
}
