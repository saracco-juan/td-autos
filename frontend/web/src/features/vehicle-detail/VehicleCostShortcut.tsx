import buttonStyles from '../../components/button.module.css'

// HU10 owns the costs route. Do not ship a link to a screen that is not integrated yet.
export default function VehicleCostShortcut() {
  return (
    <div>
      <button type="button" className={`${buttonStyles.button} ${buttonStyles.secondary}`} disabled>
        CALCULAR COSTOS
      </button>
      <small>La calculadora estará disponible próximamente.</small>
    </div>
  )
}
