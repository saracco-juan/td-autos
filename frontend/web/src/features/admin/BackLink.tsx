import { Link } from 'react-router'
import styles from './BackLink.module.css'

// Figma "Back Link": a boxed chevron and the text, back to the dealer list.
export default function BackLink() {
  return (
    <Link to="/admin/concesionarias" className={styles.backLink}>
      <span aria-hidden="true" className={styles.backIcon}>
        ‹
      </span>
      Volver a concesionarias
    </Link>
  )
}
