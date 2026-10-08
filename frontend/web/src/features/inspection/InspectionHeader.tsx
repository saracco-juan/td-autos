import type { Ref } from 'react'
import { Link } from 'react-router'
import screenStyles from '../../components/screen.module.css'
import styles from './InspectionHeader.module.css'

type Props = {
  vehicleId: number
  title: string
  completed: number
  total: number
  titleRef: Ref<HTMLHeadingElement>
}

// Shared by the checklist and the summary view: back link, eyebrow, vehicle title and counter.
export default function InspectionHeader({ vehicleId, title, completed, total, titleRef }: Props) {
  return (
    <div className={styles.header}>
      {/* The vehicle sheet (HU09) does not exist yet: the link points to its planned route. */}
      <Link to={`/vehiculos/${vehicleId}`} className={styles.back}>
        <span aria-hidden="true" className={styles.chevron}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        Volver a la ficha
      </Link>
      <div className={styles.titles}>
        <p className={screenStyles.eyebrow}>CHECKLIST DE INSPECCIÓN</p>
        <h1 ref={titleRef} tabIndex={-1} className={screenStyles.title}>
          {title}
        </h1>
        <p aria-live="polite" className={styles.counter}>
          {completed} de {total} puntos revisados
        </p>
      </div>
    </div>
  )
}
