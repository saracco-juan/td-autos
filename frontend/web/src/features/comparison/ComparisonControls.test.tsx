import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import { expect, it, vi } from 'vitest'
import ComparisonControls from './ComparisonControls'
import { useComparisonSelection } from './useComparisonSelection'

const vehicles = [{ id: 193, title: 'Hyundai Tucson 2019', image: '/tucson.jpg' },
  { id: 399, title: 'Fiat Strada 2023', image: null }]

function Harness({ available = vehicles }: { available?: typeof vehicles }) {
  const selection = useComparisonSelection()
  return <><ComparisonControls selection={selection} vehicles={available} source="favorites" />
    <p>{useLocation().pathname}{useLocation().search}</p></>
}

it('shows recognizable selections without counters or a redundant selection caption', () => {
  render(<MemoryRouter initialEntries={['/?compare=193,399']}><Harness /></MemoryRouter>)
  const control = screen.getByRole('region', { name: 'Selección para comparar' })
  expect(within(control).getByText('Hyundai Tucson 2019')).toBeVisible()
  expect(within(control).getByText('Fiat Strada 2023')).toBeVisible()
  expect(within(control).queryByText('2 seleccionados')).not.toBeInTheDocument()
  expect(within(control).getByRole('button', { name: 'COMPARAR' })).toHaveTextContent(/^Comparar$/)
  expect(control).not.toHaveTextContent('#193')
  fireEvent.click(within(control).getByRole('button', { name: 'Quitar Hyundai Tucson 2019 de la comparación' }))
  expect(within(control).queryByText('1 seleccionado')).not.toBeInTheDocument()
  expect(screen.getByText('/?compare=399')).toBeInTheDocument()
})

it('retains selected names when pagination replaces available vehicle data', () => {
  const { rerender } = render(<MemoryRouter initialEntries={['/?compare=193']}><Harness /></MemoryRouter>)
  rerender(<MemoryRouter initialEntries={['/?compare=193']}><Harness available={[]} /></MemoryRouter>)
  expect(screen.getByRole('button', { name: 'Quitar Hyundai Tucson 2019 de la comparación' })).toBeEnabled()
})

it('keeps the existing completion guidance and source-aware navigation', () => {
  const toggle = vi.fn()
  const setNotice = vi.fn()
  render(<MemoryRouter><ComparisonControls selection={{ ids: [], search: new URLSearchParams(), toggle, notice: '', setNotice }} vehicles={vehicles} /></MemoryRouter>)
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'COMPARAR' }))
  expect(setNotice).toHaveBeenCalledWith('Seleccioná exactamente dos vehículos para comparar.')
})

it('opens the existing comparison route with both IDs and the source', () => {
  render(<MemoryRouter initialEntries={['/?compare=193,399&maxKilometers=70000']}><Harness /></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: 'COMPARAR' }))
  expect(screen.getByText('/comparar?compare=193%2C399&maxKilometers=70000&source=favorites')).toBeInTheDocument()
})
