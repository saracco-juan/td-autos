import ButtonLink from '../../../components/Buttons/ButtonLink'
import type { DetailContext } from '../model/navigation'

// Keep detail context when entering the integrated calculator.
export default function VehicleCostShortcut({ vehicleId, context }: Readonly<{ vehicleId: number; context: DetailContext | null }>) {
  return <ButtonLink to={`/vehiculos/${vehicleId}/costos`} state={{ vehicleDetail: context }} variant="secondary">
    CALCULAR COSTOS
  </ButtonLink>
}
