import { Link } from 'react-router'
import styles from './VehicleNotFound.module.css'

// Unknown vehicle, or an id that cannot be one. No Figma frame: sized like ErrorState.
export default function VehicleNotFound() {
  return (
    <section className={styles.state}>
      <h1 className={styles.title}>No encontramos este vehículo.</h1>
      <Link to="/" className={styles.link}>
        Volver al inicio
      </Link>
    </section>
  )
}
