import { useId, useRef, useState } from 'react'
import { detailSections } from '@shared/vehicles/detail'
import Tabs from '../../../components/Tabs/Tabs'
import Scrollbar from '../../../components/Scrollbar/Scrollbar'
import type { BuyerVehicle } from '../model/types'
import styles from './VehicleSpecifications.module.css'

export default function VehicleSpecifications({ vehicle }: { vehicle: BuyerVehicle }) {
  const id = useId()
  const sectionRef = useRef<HTMLElement>(null)
  const groups = detailSections(vehicle)
  const [selected, setSelected] = useState(groups[0].title)

  return (
    <section ref={sectionRef} className={styles.card} aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`}>Especificaciones técnicas</h2>
      <div className={styles.tabs}>
      <Tabs variant="underline" label="Secciones de especificaciones" value={selected} panelClassName={styles.specificationsPanel}
        items={groups.map(({ title }) => ({ id: title, label: title }))}
        onValueChange={(value) => {
          setSelected(value)
          const panel = sectionRef.current?.querySelector<HTMLElement>('[role="tabpanel"]')
          if (panel) panel.scrollTop = 0
        }}>
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
      <Scrollbar containerRef={sectionRef} contentKey={selected} label="Desplazar especificaciones" />
      </div>
      <section aria-label="Descripción de la concesionaria">
        <h3>Descripción de la concesionaria</h3>
        <p className={styles.description}>{vehicle.descripcion?.trim() || 'Descripción no disponible.'}</p>
      </section>
    </section>
  )
}
