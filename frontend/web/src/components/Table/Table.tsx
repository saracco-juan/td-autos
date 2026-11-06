import { Fragment, type ComponentProps, type Key, type ReactNode } from 'react'
import styles from '../../styles/dataTable.module.css'

type Column = Readonly<{
  key: string
  header: ReactNode
  colClassName?: string
  headerClassName?: string
}>

type Props<Row> = Omit<ComponentProps<'table'>, 'children'> & Readonly<{
  columns: readonly Column[]
  rows: readonly Row[]
  rowKey: (row: Row) => Key
  renderRow: (row: Row) => ReactNode
}>

// Screens own row content and actions; the shared table owns column and row structure.
export default function Table<Row>({ columns, rows, rowKey, renderRow, className, ...props }: Props<Row>) {
  return (
    <table {...props} className={[styles.table, className].filter(Boolean).join(' ')}>
      <colgroup>
        {columns.map((column) => <col key={column.key} className={column.colClassName} />)}
      </colgroup>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column.key} scope="col" className={column.headerClassName}>{column.header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => <Fragment key={rowKey(row)}>{renderRow(row)}</Fragment>)}
      </tbody>
    </table>
  )
}
