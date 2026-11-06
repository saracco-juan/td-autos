import type { ComponentProps } from 'react'
import Pagination from './Pagination'
import styles from './ResultsPagination.module.css'

type ResultsPaginationProps = ComponentProps<typeof Pagination> & {
  className?: string
  /** Keep the controls usable inside a narrow dashboard panel. */
  wrap?: boolean
}

// Shared result-list footer: recommendation grids and receipt histories use the same controls.
export default function ResultsPagination({ className, wrap = false, ...props }: ResultsPaginationProps) {
  return (
    <div className={[styles.pager, wrap && styles.wrap, className].filter(Boolean).join(' ')}>
      <span>Página {props.page} de {props.lastPage}</span>
      <Pagination {...props} />
    </div>
  )
}
