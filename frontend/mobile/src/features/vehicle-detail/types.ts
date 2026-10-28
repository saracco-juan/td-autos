import type { DetailVehicle } from '@shared/vehicles/detail'
import type { EquipmentFacts } from '@shared/vehicles/equipment'

// Equipment flags are optional: a publication without them still renders ("No disponible").
export type BuyerVehicle = DetailVehicle & EquipmentFacts

export type VehicleDetailResponse = {
  vehicle: BuyerVehicle
  dealer: { id: number; nombre: string; provincia: string | null }
}
