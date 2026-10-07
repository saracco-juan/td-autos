import type { BodyType } from './types'
import styles from './BodyTypeChips.module.css'

type Props = {
  labelledBy: string
  bodyTypes: BodyType[]
  selected: number[]
  // Id of the validation message; set only while it is shown.
  describedBy?: string
  onToggle: (id: number) => void
}

// Multi-choice question: toggle buttons, a selected chip shows a check before its name.
export default function BodyTypeChips({ labelledBy, bodyTypes, selected, describedBy, onToggle }: Props) {
  return (
    <div role="group" aria-labelledby={labelledBy} aria-describedby={describedBy} className={styles.group}>
      {bodyTypes.map((bodyType) => {
        const isSelected = selected.includes(bodyType.id)
        return (
          <button
            key={bodyType.id}
            type="button"
            aria-pressed={isSelected}
            className={`${styles.chip} ${isSelected ? styles.selected : ''}`}
            onClick={() => onToggle(bodyType.id)}
          >
            {isSelected ? <span aria-hidden="true">✓</span> : null}
            {bodyType.nombre}
          </button>
        )
      })}
    </div>
  )
}
