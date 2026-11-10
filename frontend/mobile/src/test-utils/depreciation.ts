import type { DepreciationResponse } from '@shared/depreciation/types'
import { VEHICLE } from '@shared/checklist/inspection/fixtures'

export function depreciation(): DepreciationResponse {
  return {
    vehicle: { ...VEHICLE, kilometraje: 62000 },
    projection: {
      current_value: 20000, currency: 'USD', annual_depreciation_percent: 10,
      points: [{ years: 1, value: 18000, retained_percent: 90 },
        { years: 3, value: 14580, retained_percent: 72.9 }, { years: 5, value: 11809.8, retained_percent: 59.049 }],
    },
    reference: { source_date: '2026-10-19', years_used: [2020, 2021, 2022],
      reference_count: 1, approximate_model: null, stale: false },
  }
}
