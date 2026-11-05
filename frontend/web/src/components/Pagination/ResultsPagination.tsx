import type { ComponentProps } from 'react'
import Pagination from './Pagination'
import styles from './ResultsPagination.module.css'

// Shared result-list footer: recommendation grids and receipt histories use the same controls.
export default function ResultsPagination(props: ComponentProps<typeof Pagination>) {
  return (
    <div className={styles.pager}>
      <span>Página {props.page} de {props.lastPage}</span>
      <Pagination {...props} />
    </div>
  )
}
