import { formatPrice } from '../recommendations/format'
import type { PortalLink, PortalModel, PortalPriceSource } from './models'

export const OTHER_PORTALS_TAB = 'Otros portales'
export const PORTAL_PANEL_INTRO = 'Estos modelos encajan con tu diagnóstico. Te llevamos al portal con la búsqueda ya armada.'
export const PORTAL_FILTERS_HEADING = 'Filtros que aplicamos en Mercado Libre'
export const PORTAL_KAVAK_NOTE = 'Las publicaciones y los precios son del portal. Kavak muestra solo el modelo.'
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
  return desde === hasta ? `Año ${desde}` : `Años ${desde}–${hasta}`
}

export function portalPriceLabel(precio: PortalModel['precio']): string {
  return `Entre ${formatPrice(precio.desde_ars)} y ${formatPrice(precio.hasta_ars)} · modelos ${precio.anio_referencia}`
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

export function portalButtonLabel({ nombre }: Pick<PortalLink, 'nombre'>): string {
  return `VER EN ${nombre.toUpperCase()}`
}

export function portalLinkName(link: Pick<PortalLink, 'nombre'>, model: Pick<PortalModel, 'marca' | 'modelo'>): string {
  return `${portalButtonLabel(link)}: ${portalModelTitle(model)} (se abre en una pestaña nueva)`
}
