import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Table from '../../components/Table/Table'

describe('Table', () => {
  it('renders configured columns and rows while preserving row identity on reorder', () => {
    const rows = [{ id: 1, name: 'Autos Sur' }, { id: 2, name: 'Autos Norte' }]
    const props = {
      'aria-label': 'Concesionarias',
      columns: [{ key: 'name', header: 'Nombre', colClassName: 'name-column' }],
      rowKey: (row: typeof rows[number]) => row.id,
      renderRow: (row: typeof rows[number]) => <tr><th scope="row">{row.name}</th></tr>,
    }
    const { container, rerender } = render(<Table {...props} rows={rows} />)
    const table = screen.getByRole('table', { name: 'Concesionarias' })
    expect(within(table).getByRole('columnheader', { name: 'Nombre' })).toHaveAttribute('scope', 'col')
    expect(container.querySelector('col')).toHaveClass('name-column')
    const firstRow = screen.getByRole('row', { name: 'Autos Sur' })

    rerender(<Table {...props} rows={[rows[1], rows[0]]} />)

    expect(within(table).getAllByRole('rowheader').map((cell) => cell.textContent)).toEqual(['Autos Norte', 'Autos Sur'])
    expect(screen.getByRole('row', { name: 'Autos Sur' })).toBe(firstRow)
  })
})
