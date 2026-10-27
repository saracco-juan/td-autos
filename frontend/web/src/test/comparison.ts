import { vehicle } from '@shared/vehicles/fixtures'
import type { ComparisonEntry } from '../features/comparison/ComparisonTable'

export const entry = (id = 7): ComparisonEntry => ({
  id,
  detail: { vehicle: { ...vehicle, id, modelo: id === 7 ? 'Corolla' : 'Cronos' },
    dealer: { id: 2, nombre: 'Autos del Sur', provincia: 'CABA' } },
  recommendation: { score: 90, components: { usage: 80, body: 100, comfort: 60, priority: null },
    warnings: [], budget_excess_percent: 0 },
  costs: {
    inputs: { km_per_month: 1500, km_source: 'diagnostico', coverage: 'terceros_completo' },
    purchase: { price: 28900000, transfer: 600000, total: 29500000, budget: null },
    monthly: { fuel: 100000, insurance: 80000, patente: 20000, total: 200000, not_estimated: [] },
    yearly: { service: 900000, total: 3300000 }, rates_updated_at: '2026-10-23',
  },
})

