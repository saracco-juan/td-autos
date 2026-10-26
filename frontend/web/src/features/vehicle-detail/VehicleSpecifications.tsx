import { equipmentValue, specificationGroups } from '@shared/vehicles/detail'
import { EQUIPMENT_EXPLANATIONS } from '@shared/vehicles/equipment'
import { EQUIPMENT_GROUPS } from '../inventory/matchingFields'
import type { BuyerVehicle } from './types'
import styles from './VehicleSpecifications.module.css'

export default function VehicleSpecifications({ vehicle }: { vehicle: BuyerVehicle }) {
  return (
    <section className={styles.card} aria-labelledby="vehicle-specifications">
      <h2 id="vehicle-specifications">Especificaciones técnicas</h2>
      {specificationGroups(vehicle).map(({ title, rows }) => (
        <section key={title} aria-label={title}>
          <h3>{title}</h3>
          <dl className={styles.rows}>
            {rows.map(({ label, value, explanation }) => (
              <div className={styles.row} key={label}>
                <dt>{label}{explanation ? <small>{explanation}</small> : null}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
      {Object.entries(EQUIPMENT_GROUPS).map(([group, fields]) => (
        <section key={group} aria-label={group}>
          <h3>{group}</h3>
          <dl className={styles.rows}>
            {fields.map(([key, label]) => (
              <div className={styles.row} key={key}>
                <dt>{label}<small>{EQUIPMENT_EXPLANATIONS[key]}</small></dt>
                <dd>{equipmentValue(vehicle[key])}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
      <section aria-label="Descripción de la concesionaria">
        <h3>Descripción de la concesionaria</h3>
        <p className={styles.description}>{vehicle.descripcion?.trim() || 'Descripción no disponible.'}</p>
      </section>
    </section>
  )
}
