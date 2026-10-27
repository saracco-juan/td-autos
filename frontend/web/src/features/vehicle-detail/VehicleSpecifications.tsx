import { useId } from 'react'
import { equipmentValue, specificationGroups } from '@shared/vehicles/detail'
import { EQUIPMENT_EXPLANATIONS } from '@shared/vehicles/equipment'
import Tabs from '../../components/Tabs'
import { EQUIPMENT_GROUPS } from '../inventory/matchingFields'
import type { BuyerVehicle } from './types'
import styles from './VehicleSpecifications.module.css'

export default function VehicleSpecifications({ vehicle }: { vehicle: BuyerVehicle }) {
  const id = useId()
  const groups = [
    ...specificationGroups(vehicle),
    ...Object.entries(EQUIPMENT_GROUPS).map(([title, fields]) => ({
      title,
      rows: fields.map(([key, label]) => ({ label, value: equipmentValue(vehicle[key]),
        explanation: EQUIPMENT_EXPLANATIONS[key] })),
    })),
  ]

  return (
    <section className={styles.card} aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`}>Especificaciones técnicas</h2>
      <Tabs label="Secciones de especificaciones" items={groups.map(({ title }) => ({ id: title, label: title }))}>
        {(section) => groups.filter(({ title }) => title === section).map(({ title, rows }) => (
          <dl className={styles.rows} key={title}>
            {rows.map(({ label, value, explanation }) => (
              <div className={styles.row} key={label}>
                <dt>{label}{explanation ? <small>{explanation}</small> : null}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        ))}
      </Tabs>
      <section aria-label="Descripción de la concesionaria">
        <h3>Descripción de la concesionaria</h3>
        <p className={styles.description}>{vehicle.descripcion?.trim() || 'Descripción no disponible.'}</p>
      </section>
    </section>
  )
}
