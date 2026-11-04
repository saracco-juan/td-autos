import { render, screen, within } from '@testing-library/react'
import { expect, it } from 'vitest'
import MetricsOverview from './MetricsOverview'

it('shows total contacts and inventory coverage with separate, correctly scaled indicators', () => {
  render(<MetricsOverview data={{ period: 'month', total: 10, vehicles: [
    { id: 1, label: 'Corolla', brand: 'Toyota', leads: 4 },
    { id: 2, label: 'Focus', brand: 'Ford', leads: 3 },
    { id: 3, label: 'Yaris', brand: 'Toyota', leads: 2 },
    { id: 4, label: 'Cronos', brand: 'Fiat', leads: 1 },
    { id: 5, label: 'Polo', brand: 'Volkswagen', leads: 0 },
  ] }} />)
  expect(screen.getByLabelText('Total de contactos')).toHaveTextContent('10')
  expect(screen.getByRole('meter', { name: 'Porcentaje de vehículos contactados' })).toHaveAttribute('value', '80')
  expect(screen.getByText('4 de 5 vehículos recibieron contactos')).toBeInTheDocument()
  const brands = within(screen.getByRole('region', { name: 'Contactos por marca' }))
  expect(brands.getByRole('meter', { name: 'Contactos de la marca Toyota' })).toHaveAttribute('value', '6')
  expect(brands.queryByText('Volkswagen')).not.toBeInTheDocument()
  expect(screen.getByRole('meter', { name: 'Concentración de contactos' })).toHaveAttribute('aria-valuenow', '90')
  expect(screen.getByText(/tus 3 vehículos más consultados/)).toBeInTheDocument()
})

it('keeps the zero-contact state free of misleading brand or concentration charts', () => {
  render(<MetricsOverview data={{ period: 'week', total: 0, vehicles: [{ id: 1, label: 'Auto', leads: 0 }] }} />)
  expect(screen.getByLabelText('Total de contactos')).toHaveTextContent('0')
  expect(screen.getByRole('meter', { name: 'Porcentaje de vehículos contactados' })).toHaveAttribute('value', '0')
  expect(screen.queryByRole('region', { name: 'Contactos por marca' })).not.toBeInTheDocument()
  expect(screen.queryByRole('meter', { name: 'Concentración de contactos' })).not.toBeInTheDocument()
})

it('uses singular concentration copy when only one vehicle has contacts', () => {
  render(<MetricsOverview data={{ period: 'all', total: 2, vehicles: [{ id: 1, label: 'Auto', brand: 'Fiat', leads: 2 }] }} />)
  expect(screen.getByRole('meter', { name: 'Concentración de contactos' })).toHaveAttribute('aria-valuenow', '100')
  expect(screen.getByText(/tu vehículo más consultado/)).toBeInTheDocument()
})
