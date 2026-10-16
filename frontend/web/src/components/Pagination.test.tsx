import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import Pagination from './Pagination'

const nav = () => screen.getByRole('navigation', { name: 'Paginación' })

// Visible labels in order: numbers as text, ellipses as "…".
function labels() {
  return within(nav())
    .getAllByRole('listitem')
    .map((item) => item.textContent)
}

describe('Pagination', () => {
  it('shows first, last, siblings and ellipses around a middle page', () => {
    render(<Pagination page={10} lastPage={418} onChange={() => {}} />)

    expect(labels()).toEqual(['1', '…', '9', '10', '11', '…', '418'])
  })

  it('lists every page when there are few', () => {
    render(<Pagination page={2} lastPage={5} onChange={() => {}} />)

    expect(labels()).toEqual(['1', '2', '3', '4', '5'])
  })

  it('keeps the start pages together near the first page', () => {
    render(<Pagination page={1} lastPage={418} onChange={() => {}} />)

    expect(labels()).toEqual(['1', '2', '3', '4', '5', '…', '418'])
  })

  it('keeps the end pages together near the last page', () => {
    render(<Pagination page={418} lastPage={418} onChange={() => {}} />)

    expect(labels()).toEqual(['1', '…', '414', '415', '416', '417', '418'])
  })

  it('drops the siblings on small screens', () => {
    render(<Pagination page={10} lastPage={418} siblingCount={0} onChange={() => {}} />)

    expect(labels()).toEqual(['1', '…', '10', '…', '418'])
  })

  it('marks only the current page and gives each number an accessible name', () => {
    render(<Pagination page={10} lastPage={418} onChange={() => {}} />)

    expect(screen.getByRole('button', { name: 'Página 10' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Página 9' })).not.toHaveAttribute('aria-current')
  })

  it('disables previous on the first page and next on the last', () => {
    const { rerender } = render(<Pagination page={1} lastPage={3} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Página siguiente' })).toBeEnabled()

    rerender(<Pagination page={3} lastPage={3} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Página siguiente' })).toBeDisabled()
  })

  it('reports the clicked page, the previous one and the next one', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Pagination page={10} lastPage={418} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Página 11' }))
    await user.click(screen.getByRole('button', { name: 'Página anterior' }))
    await user.click(screen.getByRole('button', { name: 'Página siguiente' }))
    await user.click(screen.getByRole('button', { name: 'Página 418' }))

    expect(onChange.mock.calls.map(([value]) => value)).toEqual([11, 9, 11, 418])
  })

  it('does not report a click on the current page', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Pagination page={2} lastPage={3} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Página 2' }))

    expect(onChange).not.toHaveBeenCalled()
  })

  it('offers a "Mostrar" selector with the page sizes and reports the chosen one', async () => {
    const user = userEvent.setup()
    const onPageSizeChange = vi.fn()
    render(
      <Pagination
        page={1}
        lastPage={6}
        onChange={() => {}}
        pageSize={10}
        pageSizeOptions={[10, 25, 50]}
        onPageSizeChange={onPageSizeChange}
      />,
    )

    const select = screen.getByRole('combobox', { name: 'Mostrar' })
    expect(select).toHaveValue('10')
    expect(within(select).getAllByRole('option').map((option) => option.textContent)).toEqual(['10', '25', '50'])

    await user.selectOptions(select, '25')

    expect(onPageSizeChange).toHaveBeenCalledWith(25)
  })

  it('shows no selector when no page size handler is given', () => {
    render(<Pagination page={1} lastPage={6} onChange={() => {}} />)

    expect(screen.queryByRole('combobox', { name: 'Mostrar' })).not.toBeInTheDocument()
  })
})
