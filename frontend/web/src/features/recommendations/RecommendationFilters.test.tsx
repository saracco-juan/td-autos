import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { expect, it, vi } from 'vitest'
import type { RecommendationFilters as Filters } from '@shared/recommendations/filters'
import RecommendationFilters from './RecommendationFilters'

function Harness({ changed = vi.fn() }) {
  const [value, setValue] = useState<Filters>({})
  return <RecommendationFilters value={value} onChange={(next) => { setValue(next); changed(next) }} />
}

it('HU07 keeps edits as drafts until APPLY and shows removable applied chips', async () => {
  const user = userEvent.setup()
  const changed = vi.fn()
  render(<Harness changed={changed} />)
  await user.click(screen.getByText('FILTROS'))
  await user.type(screen.getByLabelText('Precio máximo (ARS)'), '20000000')
  await user.type(screen.getByLabelText('Año desde'), '2020')
  await user.type(screen.getByLabelText('Kilometraje máximo'), '60000')
  await user.selectOptions(screen.getByLabelText('Transmisión'), 'automatica')
  expect(changed).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'APLICAR' }))
  expect(changed).toHaveBeenLastCalledWith({ maxPrice: 20000000, minYear: 2020,
    maxKilometers: 60000, transmission: 'automatica' })
  expect(screen.getByRole('button', { name: 'FILTROS' })).toHaveAttribute('aria-expanded', 'false')
  expect(screen.getByRole('button', { name: 'Quitar Desde 2020' })).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Quitar Desde 2020' }))
  expect(changed).toHaveBeenLastCalledWith({ maxPrice: 20000000, minYear: undefined,
    maxKilometers: 60000, transmission: 'automatica' })
  expect(screen.getByLabelText('Año desde')).toHaveValue(null)
  await user.click(screen.getByRole('button', { name: 'LIMPIAR FILTROS' }))
  expect(changed).toHaveBeenLastCalledWith({})
  expect(screen.queryByRole('group', { name: 'Filtros aplicados' })).not.toBeInTheDocument()
  expect(screen.getByLabelText('Transmisión')).toHaveValue('')
})

it('HU07 restores applied values and allows blank fields without inventing zero bounds', async () => {
  const changed = vi.fn()
  render(<RecommendationFilters value={{ minYear: 2020, transmission: 'manual' }} onChange={changed} />)
  await userEvent.click(screen.getByText('FILTROS'))
  expect(screen.getByLabelText('Año desde')).toHaveValue(2020)
  expect(screen.getByLabelText('Transmisión')).toHaveValue('manual')
  await userEvent.clear(screen.getByLabelText('Año desde'))
  await userEvent.selectOptions(screen.getByLabelText('Transmisión'), '')
  await userEvent.click(screen.getByRole('button', { name: 'APLICAR' }))
  expect(changed).toHaveBeenCalledWith({ maxPrice: undefined, minYear: undefined,
    maxKilometers: undefined, transmission: undefined })
})

it('HU07 rejects negative numeric drafts without applying or removing current filters', async () => {
  const changed = vi.fn()
  render(<RecommendationFilters value={{ transmission: 'manual' }} onChange={changed} />)
  await userEvent.click(screen.getByText('FILTROS'))
  await userEvent.type(screen.getByLabelText('Kilometraje máximo'), '-1')
  await userEvent.click(screen.getByRole('button', { name: 'APLICAR' }))
  expect(changed).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Quitar Manual' })).toBeVisible()
})
