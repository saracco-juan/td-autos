import styles from './SessionLoading.module.css'

// Neutral placeholder while the session is being read: guarded content must not flash.
export default function SessionLoading() {
  return (
    <p role="status" className={styles.loading}>
      <span aria-hidden="true" className={styles.spinner} />
      Cargando…
    </p>
  )
}
