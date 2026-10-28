import type { Recommendation, RecommendationsResponse } from '@shared/recommendations/matching'

export function recommendation(id: number, overrides: Partial<Recommendation> = {}): Recommendation {
  return {
    listing_id: id,
    score: 95 - id,
    components: { usage: 100, body: 100, priority: 80, comfort: 70 },
    published_price: 20000000 + id * 1000000,
    published_currency: 'ARS',
    price_ars: 20000000 + id * 1000000,
    price_usd: 20000 + id * 1000,
    budget_excess_percent: 0,
    budget_penalty: 0,
    warnings: [],
    vehicle: {
      marca: 'Toyota', modelo: `Modelo ${id}`, version: 'XEI', anio: 2015 + id, kilometraje: 10000 * id,
      ubicacion: 'CABA', transmision: id % 2 === 0 ? 'manual' : 'automatica', combustible: 'nafta',
      carroceria: 'Sedán', image_url: null,
    },
    dealer: { id: 1, nombre: 'Autos Sur', provincia: 'Buenos Aires' },
    ...overrides,
  }
}

export function ready(results: Recommendation[]): RecommendationsResponse {
  return {
    status: 'ready',
    results,
    exchange_rate: { quote: { sell: 1000, source: 'DolarAPI', updated_at: '2026-10-20T15:00:00Z' }, stale: false, warning: null },
  }
}
