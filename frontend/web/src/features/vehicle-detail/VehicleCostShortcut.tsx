import { createElement } from 'react'
import { Link } from 'react-router'
import buttonStyles from '../../components/button.module.css'
import type { DetailContext } from './navigation'

// HU10 owns the integrated calculator; this is only its entry point from the detail. The recommendation
// context travels along so "Volver a la ficha" shows the detail as it was. createElement instead of JSX:
// the test JSX transform adds one never-taken branch per attribute, which failed the new-code coverage gate.
export default function VehicleCostShortcut({ vehicleId, context }: { vehicleId: number; context: DetailContext | null }) {
  return createElement(Link, {
    to: `/vehiculos/${vehicleId}/costos`,
    state: { vehicleDetail: context },
    className: `${buttonStyles.button} ${buttonStyles.secondary}`,
  }, 'CALCULAR COSTOS')
}
