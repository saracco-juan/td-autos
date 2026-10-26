import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { equipmentValue, specificationGroups } from '@shared/vehicles/detail'
import { EQUIPMENT_EXPLANATIONS } from '@shared/vehicles/equipment'
import { EQUIPMENT_GROUPS } from '../inventory/matchingFields'
import type { BuyerVehicle } from './types'
import styles from './VehicleSpecifications.module.css'

export default function VehicleSpecifications({ vehicle }: { vehicle: BuyerVehicle }) {
  const id = useId()
  const [selected, setSelected] = useState(0)
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const groups = [
    ...specificationGroups(vehicle),
    ...Object.entries(EQUIPMENT_GROUPS).map(([title, fields]) => ({
      title,
      rows: fields.map(([key, label]) => ({ label, value: equipmentValue(vehicle[key]),
        explanation: EQUIPMENT_EXPLANATIONS[key] })),
    })),
  ]

  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = { ArrowRight: (index + 1) % groups.length,
      ArrowLeft: (index + groups.length - 1) % groups.length,
      Home: 0, End: groups.length - 1 }[event.key]
    if (next === undefined) return
    event.preventDefault()
    setSelected(next)
    tabs.current[next]?.focus()
  }

  return (
    <section className={styles.card} aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`}>Especificaciones técnicas</h2>
      <div className={styles.tabs} role="tablist" aria-label="Secciones de especificaciones">
        {groups.map(({ title }, index) => (
          <button key={title} type="button" role="tab" id={`${id}-tab-${index}`}
            aria-controls={`${id}-panel-${index}`} aria-selected={selected === index}
            tabIndex={selected === index ? 0 : -1} className={styles.tab}
            ref={(element) => { tabs.current[index] = element }}
            onClick={() => setSelected(index)} onKeyDown={(event) => navigate(event, index)}>
            {title}
          </button>
        ))}
      </div>
      {groups.map(({ title, rows }, index) => (
        <div key={title} role="tabpanel" id={`${id}-panel-${index}`}
          aria-labelledby={`${id}-tab-${index}`} hidden={selected !== index} tabIndex={0}>
          {selected === index ? (
            <dl className={styles.rows}>
              {rows.map(({ label, value, explanation }) => (
                <div className={styles.row} key={label}>
                  <dt>{label}{explanation ? <small>{explanation}</small> : null}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      ))}
      <section aria-label="Descripción de la concesionaria">
        <h3>Descripción de la concesionaria</h3>
        <p className={styles.description}>{vehicle.descripcion?.trim() || 'Descripción no disponible.'}</p>
      </section>
    </section>
  )
}
