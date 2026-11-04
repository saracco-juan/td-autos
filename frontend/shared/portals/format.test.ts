import { describe, expect, it } from 'vitest'
import {
  OTHER_PORTALS_TAB, PORTAL_EMPTY_COPY, PORTAL_FILTERS_HEADING, PORTAL_KAVAK_NOTE, PORTAL_MODELS_NOTICE,
  PORTAL_REASONS_HEADING, portalButtonLabel, portalCountLabel, portalInfoLabel, portalLinkName, portalModelTitle,
  portalPriceRange, portalPriceYear, portalSourceLabel, portalTabLabel, portalYearsLabel, titleCaseBrand,
} from './format'
import type { PortalModel } from './models'

const model: PortalModel = {
  id: 1, marca: 'TOYOTA', modelo: 'Etios', carroceria: 'Hatchback',
  anios: { desde: 2017, hasta: 2025 },
  precio: { desde_ars: 24662900, hasta_ars: 32670000, anio_referencia: 2025 },
  motivos: ['Consumo bajo'], filtros: ['Hatchback'],
  links: [{ portal: 'mercadolibre', nombre: 'Mercado Libre', url: 'https://autos.mercadolibre.com.ar/x' }],
  imagen_url: null,
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

  it('names the info button of a card after its model', () => {
    expect(portalInfoLabel(model)).toBe('Más información sobre Toyota Etios')
  })

  it('labels a year range or a single year', () => {
    expect(portalYearsLabel({ desde: 2017, hasta: 2025 })).toBe('Modelos 2017–2025')
    expect(portalYearsLabel({ desde: 2020, hasta: 2020 })).toBe('Modelo 2020')
  })

  it('splits the price into a peso range and the reference model year', () => {
    expect(portalPriceRange(model.precio)).toBe('$ 24.662.900 – $ 32.670.000')
    expect(portalPriceYear(model.precio)).toBe('Precio de referencia del modelo 2025')
  })

  it('counts the recommended models for the page subtitle, singular for one', () => {
    expect(portalCountLabel(9)).toBe('9 modelos recomendados')
    expect(portalCountLabel(1)).toBe('1 modelo recomendado')
  })

  it('labels the tab with the count only once it is known, singular for one', () => {
    expect(OTHER_PORTALS_TAB).toBe('Otros portales')
    expect(portalTabLabel(null)).toBe('Otros portales')
    expect(portalTabLabel(9)).toBe('Otros portales · 9 modelos')
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
    expect(PORTAL_MODELS_NOTICE).toBe('Estos son modelos, no unidades en venta. La foto muestra cómo es el modelo. Elegí un portal y te llevamos a la búsqueda ya armada para que veas las unidades reales.')
    expect(PORTAL_REASONS_HEADING).toBe('Por qué te lo recomendamos')
    expect(PORTAL_FILTERS_HEADING).toBe('Filtros que aplicamos en Mercado Libre')
    expect(PORTAL_KAVAK_NOTE).toBe('Las unidades y sus precios reales son del portal. En Kavak aplicamos solo la transmisión.')
    expect(PORTAL_EMPTY_COPY).toEqual({
      title: 'No encontramos modelos para tu diagnóstico.',
      hint: 'Probá ajustando el presupuesto o la carrocería.',
    })
  })
})
