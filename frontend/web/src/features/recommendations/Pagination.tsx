import buttonStyles from '../../components/button.module.css'
import styles from './Pagination.module.css'

type PaginationProps = {
  page: number
  lastPage: number
  onChange: (page: number) => void
}

// Previous / next control under the results grid (D9). Not in Figma yet: see the "Figma sync" table of UH-06.
export default function Pagination({ page, lastPage, onChange }: PaginationProps) {
  return (
    <nav aria-label="Paginación" className={styles.pagination}>
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className={`${buttonStyles.button} ${buttonStyles.secondary} ${styles.step}`}
      >
        ANTERIOR
      </button>
      <span className={styles.position}>
        Página {page} de {lastPage}
      </span>
      <button
        type="button"
        disabled={page >= lastPage}
        onClick={() => onChange(page + 1)}
        className={`${buttonStyles.button} ${buttonStyles.secondary} ${styles.step}`}
      >
        SIGUIENTE
      </button>
    </nav>
  )
}
