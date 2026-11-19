import { vehicleProfiles, type VehicleShape } from '@shared/diagnosis/vehicleSilhouettes'
import styles from './VehicleSilhouette.module.css'

export type { VehicleShape } from '@shared/diagnosis/vehicleSilhouettes'

export default function VehicleSilhouette({ shape, className = '' }: Readonly<{ shape: VehicleShape; className?: string }>) {
  const profile = vehicleProfiles[shape]
  const sport = shape === 'sport'

  return (
    <svg viewBox="0 0 240 96" className={`${styles.figure} ${sport ? styles.sport : ''} ${className}`}
      aria-hidden="true" focusable="false">
      <path className={styles.body} d={profile.body} />
      <path className={styles.windows} d={profile.windows} />
      {profile.details ? <path className={styles.details} d={profile.details} /> : null}
      {profile.wheels.map((x) => (
        <g key={x}>
          <circle className={styles.tire} cx={x} cy="69" r="14" />
          <circle className={styles.rim} cx={x} cy="69" r="8" />
          {sport ? <>
            <path className={styles.spokes} d={`M${x} 61v16m-8-8h16m-13.5-5.5 11 11m-11 0 11-11`} />
            <circle className={styles.hub} cx={x} cy="69" r="2" />
          </> : null}
        </g>
      ))}
      {sport ? <path className={styles.headlight} d="m197 51 17 5-12 1-9-4Z" /> : null}
    </svg>
  )
}
