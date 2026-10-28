import type { InspectionVehicle } from '../checklist/inspection/types'

export type DepreciationProjection = {
  current_value: number
  currency: 'ARS' | 'USD'
  annual_depreciation_percent: number
  points: { years: number; value: number; retained_percent: number }[]
}

export type DepreciationReference = {
  source_date: string | null
  years_used: number[]
  reference_count: number
  approximate_model: string | null
  stale: boolean
}

export type DepreciationResponse = {
  vehicle: InspectionVehicle & { kilometraje: number | null }
  projection: DepreciationProjection | null
  reference: DepreciationReference | null
}
