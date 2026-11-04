import { describe, expect, it } from 'vitest'
import {
  budgetPenaltyNote, compatibilityLabel, componentsSummary, emptyStateCopy, equivalentPriceLabel, exchangeRateNotice,
  formatKilometers, formatPrice, recommendationTitle, vehicleCount, warningMessages,
} from './format'
import type { Recommendation } from './matching'

const result: Recommendation = {
  listing_id: 7, score: 87.25, components: { usage: 100, body: 50, priority: null, comfort: 80 },
  published_price: 20000, published_currency: 'USD', price_ars: 21000000, price_usd: 20000,
  budget_excess_percent: 2.5, budget_penalty: 5, warnings: [],
  vehicle: { marca: 'Toyota', modelo: 'Corolla', version: null, anio: 2021, kilometraje: 62000, ubicacion: 'CABA',
    transmision: 'automatica', combustible: 'nafta', carroceria: 'Sedán', image_url: null },
  dealer: { id: 1, nombre: 'Autos Sur', provincia: 'Buenos Aires' },
}

describe('HU05 recommendation formatting shared by web and mobile', () => {
  it('formats prices, kilometers and the title, skipping a missing version', () => {
    expect(formatPrice(28900000)).toBe('$ 28.900.000')
    expect(formatPrice(15000, 'USD')).toBe('US$ 15.000')
    expect(formatKilometers(62000)).toBe('62.000 km')
    expect(recommendationTitle(result)).toBe('Toyota Corolla 2021')
    expect(vehicleCount(1)).toBe('Mostrando 1 vehículo')
    expect(vehicleCount(10)).toBe('Mostrando 10 vehículos')
  })

  it('shows the score, the equivalent price in the other currency and the score breakdown', () => {
    expect(compatibilityLabel(result)).toBe('87,3% de compatibilidad')
    expect(equivalentPriceLabel(result)).toBe('Equivalente: $ 21.000.000')
    expect(equivalentPriceLabel({ ...result, published_currency: 'ARS', price_usd: null }))
      .toBe('Equivalente en USD no disponible.')
    expect(componentsSummary(result)).toBe('Uso: 100 · Carrocería: 50 · Prioridad: no disponible · Confort: 80 (sobre 100).')
    expect(budgetPenaltyNote(result)).toMatch(/^Descuento por presupuesto: 5 puntos\./)
  })

  it('turns every warning code into its message', () => {
    expect(warningMessages(result)).toEqual([])
    expect(warningMessages({ ...result, warnings: ['resale_stale', 'body_mismatch', 'budget_exceeded', 'resale_unavailable'] }))
      .toEqual([
        'Supera tu presupuesto en 2,5%.',
        'No coincide con la carrocería elegida.',
        expect.stringMatching(/^Sin estimación de reventa/),
        expect.stringMatching(/^Reventa calculada/),
      ])
  })

  it('distinguishes an available value projection from a missing combined resale score', () => {
    const partial: Recommendation = { ...result, warnings: ['resale_unavailable'], resale: {
      activity_score: null, retention_score: 81.5, source_date: '2026-10-19',
      window_start: null, window_end: null, stale: false,
      estimate: { method: 'annualized', horizon_years: 3, annual_depreciation_percent: 6.6,
        retained_percent: 81.5, years_used: [2020, 2021] },
    } }
    expect(warningMessages(partial)).toEqual([
      'Hay proyección de valor, pero faltan datos de actividad del mercado para evaluar la reventa. Compatibilidad parcial: descuento de 10 puntos por falta de datos, no por mala reventa.',
    ])
    expect(partial.score).toBe(result.score)
    expect(partial.components.priority).toBeNull()
    expect(warningMessages({ ...partial, warnings: [] })).toEqual([])
    expect(warningMessages({ ...partial, resale: { ...partial.resale!, estimate: null } })[0])
      .toMatch(/^Sin estimación de reventa/)
  })

  it('explains a missing or stale quote', () => {
    const quote = { sell: 1000, source: 'DolarAPI', updated_at: '2026-10-20T15:00:00Z' }
    expect(exchangeRateNotice({ quote, stale: false, warning: null }))
      .toEqual({ summary: expect.stringMatching(/^Dólar oficial venta · DolarAPI · \$ 1\.000 · /), warning: null })
    expect(exchangeRateNotice({ quote, stale: true, warning: 'exchange_rate_stale' }).warning)
      .toBe('Última cotización disponible: no se pudo actualizar.')
    expect(exchangeRateNotice(null)).toEqual({ summary: null, warning: expect.stringMatching(/^Sin cotización/) })
  })

  it('TC-16 / TC-75 empty states: no match, incomplete diagnosis and filters without results', () => {
    expect(emptyStateCopy('ready', false)).toEqual({
      title: 'No encontramos vehículos que coincidan con tu diagnóstico.',
      hint: 'Ajustá el diagnóstico para buscar otras opciones.',
    })
    expect(emptyStateCopy('diagnosis_incomplete', true).title).toBe('Completá tu diagnóstico para ver recomendaciones.')
    expect(emptyStateCopy('ready', true).title).toBe('No encontramos vehículos que cumplan estos filtros.')
  })
})
