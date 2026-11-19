import type { BodyType } from '@shared/diagnosis/types'
import styles from './BodyTypeChips.module.css'
import VehicleSilhouette from './VehicleSilhouette'
import { bodyTypeShapes } from '@shared/diagnosis/vehicleSilhouettes'

type Props = {
  labelledBy: string
  bodyTypes: BodyType[]
  selected: number[]
  // Id of the validation message; set only while it is shown.
  describedBy?: string
  onToggle: (id: number) => void
}

// The label remains the accessible name; illustrations are decorative.
export default function BodyTypeChips({ labelledBy, bodyTypes, selected, describedBy, onToggle }: Props) {
  return (
    <div role="group" aria-labelledby={labelledBy} aria-describedby={describedBy} className={styles.group}>
      {bodyTypes.map((bodyType) => {
        const isSelected = selected.includes(bodyType.id)
        const shape = bodyTypeShapes[bodyType.nombre]
        return (
          <button
            key={bodyType.id}
            type="button"
            aria-pressed={isSelected}
            className={`${styles.chip} ${isSelected ? styles.selected : ''}`}
            onClick={() => onToggle(bodyType.id)}
          >
            {shape ? <VehicleSilhouette shape={shape} className={styles.silhouette} /> : null}
            <span className={styles.name}>
              {isSelected ? <svg className={styles.check} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                <path d="m3 8 3 3 7-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg> : null}
              {bodyType.nombre}
            </span>
          </button>
        )
      })}
    </div>
  )
}
