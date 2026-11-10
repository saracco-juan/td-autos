import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import ResultsPagination from '../../components/Pagination/ResultsPagination'

it('preserves the default counter, navigation and page-size callbacks', async () => {
  const onChange = vi.fn()
  const onPageSizeChange = vi.fn()
  render(<ResultsPagination page={1} lastPage={3} onChange={onChange}
    pageSize={10} onPageSizeChange={onPageSizeChange} />)

  expect(screen.getByText('Página 1 de 3')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Página siguiente' }))
  expect(onChange).toHaveBeenCalledWith(2)
  await userEvent.selectOptions(screen.getByLabelText('Mostrar'), '25')
  expect(onPageSizeChange).toHaveBeenCalledWith(25)
})

it('accepts an explicit wrapping layout and a class on its public container', () => {
  const { container } = render(<ResultsPagination page={1} lastPage={3} onChange={vi.fn()}
    wrap className="metrics-pagination" />)

  expect(container.firstElementChild).toHaveClass('metrics-pagination')
  expect(screen.getByText('Página 1 de 3')).toBeInTheDocument()
  expect(screen.getByRole('navigation', { name: 'Paginación' })).not.toHaveAttribute('wrap')
})
