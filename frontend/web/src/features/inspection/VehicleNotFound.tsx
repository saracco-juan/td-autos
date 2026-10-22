import { Link } from 'react-router'
import { NOT_FOUND_LINK, NOT_FOUND_TITLE } from '@shared/checklist/inspection/copy'
import styles from './VehicleNotFound.module.css'

// Unknown vehicle, or an id that cannot be one. No Figma frame: sized like ErrorState.
export default function VehicleNotFound() {
  return (
    <section className={styles.state}>
      <h1 className={styles.title}>{NOT_FOUND_TITLE}</h1>
      <Link to="/" className={styles.link}>
        {NOT_FOUND_LINK}
      </Link>
    </section>
  )
}
