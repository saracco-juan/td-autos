import type { DetailVehicle } from '@shared/vehicles/detail'
import type { MatchingFacts } from '../inventory/matchingFields'

export type BuyerVehicle = DetailVehicle & Partial<Omit<MatchingFacts, 'moneda'>>
export type VehicleDetailResponse = {
  vehicle: BuyerVehicle
  dealer: { id: number; nombre: string; provincia: string | null }
  is_favorite?: boolean
  whatsapp_available?: boolean
}
