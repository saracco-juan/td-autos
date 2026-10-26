import { Link } from 'react-router'
import buttonStyles from '../../components/button.module.css'

// HU10 owns the integrated calculator; this is only its entry point from the detail.
export default function VehicleCostShortcut({ vehicleId }: { vehicleId: number }) {
  return (
    <Link to={`/vehiculos/${vehicleId}/costos`} className={`${buttonStyles.button} ${buttonStyles.secondary}`}>
      CALCULAR COSTOS
    </Link>
  )
}
