import { describe, expect, it } from 'vitest'
import {
  OTHER_PORTALS_TAB, PORTAL_EMPTY_COPY, PORTAL_FILTERS_HEADING, PORTAL_KAVAK_NOTE, PORTAL_PANEL_INTRO,
  PORTAL_PRICE_LABEL, portalButtonLabel, portalCountLabel, portalLinkName, portalModelTitle, portalPriceRange,
  portalPriceYear, portalSourceLabel, portalTabLabel,
  portalYearsLabel, titleCaseBrand,
} from './format'
import type { PortalModel } from './models'

const model: PortalModel = {
  id: 1, marca: 'TOYOTA', modelo: 'Etios', carroceria: 'Hatchback',
  anios: { desde: 2017, hasta: 2025 },
  precio: { desde_ars: 24662900, hasta_ars: 32670000, anio_referencia: 2025 },
  motivos: ['Consumo bajo'], filtros: ['Hatchback'],
  links: [{ portal: 'mercadolibre', nombre: 'Mercado Libre', url: 'https://autos.mercadolibre.com.ar/x' }],
}

describe('HU06 portal models formatting shared by web and mobile', () => {
  it('title-cases the uppercase catalog brand and keeps known acronyms', () => {
    expect(titleCaseBrand('TOYOTA')).toBe('Toyota')
    expect(titleCaseBrand('ALFA ROMEO')).toBe('Alfa Romeo')
    expect(titleCaseBrand('MERCEDES-BENZ')).toBe('Mercedes-Benz')
    expect(titleCaseBrand('BMW')).toBe('BMW')
  })

  it('builds the card title from the brand and the model as stored', () => {
    expect(portalModelTitle(model)).toBe('Toyota Etios')
  })

  it('labels a year range or a single year', () => {
    expect(portalYearsLabel({ desde: 2017, hasta: 2025 })).toBe('Años 2017–2025')
    expect(portalYearsLabel({ desde: 2020, hasta: 2020 })).toBe('Año 2020')
  })

  it('splits the price into a label, a peso range and the reference model year', () => {
    expect(PORTAL_PRICE_LABEL).toBe('Precio de referencia')
    expect(portalPriceRange(model.precio)).toBe('$ 24.662.900 – $ 32.670.000')
    expect(portalPriceYear(model.precio)).toBe('modelos 2025')
  })

  it('counts the recommended models for the page subtitle, singular for one', () => {
    expect(portalCountLabel(8)).toBe('8 modelos recomendados')
    expect(portalCountLabel(1)).toBe('1 modelo recomendado')
  })

  it('labels the tab with the count only once it is known, singular for one', () => {
    expect(OTHER_PORTALS_TAB).toBe('Otros portales')
    expect(portalTabLabel(null)).toBe('Otros portales')
    expect(portalTabLabel(8)).toBe('Otros portales · 8 modelos')
    expect(portalTabLabel(1)).toBe('Otros portales · 1 modelo')
  })

  it('formats the price source date as dd/mm/yyyy without timezone shifts', () => {
    expect(portalSourceLabel({ nombre: 'Guía de precios ACARA', fecha: '2026-10-19' }))
      .toBe('Precios de referencia: Guía de precios ACARA, 19/10/2026')
    expect(portalSourceLabel({ nombre: 'Guía', fecha: '2026-01-05' })).toBe('Precios de referencia: Guía, 05/01/2026')
  })

  it('labels each portal button in uppercase with an accessible name that opens a new tab', () => {
    const [link] = model.links
    expect(portalButtonLabel(link)).toBe('VER EN MERCADO LIBRE')
    expect(portalLinkName(link, model)).toBe('VER EN MERCADO LIBRE: Toyota Etios (se abre en una pestaña nueva)')
  })

  it('keeps the fixed copy in one place', () => {
    expect(PORTAL_PANEL_INTRO).toBe('Estos modelos encajan con tu diagnóstico. Te llevamos al portal con la búsqueda ya armada.')
    expect(PORTAL_FILTERS_HEADING).toBe('Filtros que aplicamos en Mercado Libre')
    expect(PORTAL_KAVAK_NOTE).toBe('Las publicaciones y los precios son del portal. En Kavak aplicamos solo la transmisión.')
    expect(PORTAL_EMPTY_COPY).toEqual({
      title: 'No encontramos modelos para tu diagnóstico.',
      hint: 'Probá ajustando el presupuesto o la carrocería.',
    })
  })
})
