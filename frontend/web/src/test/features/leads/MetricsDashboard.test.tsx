import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { apiFetch } from '../../../lib/http'
import LeadsPage from '../../../features/leads/pages/LeadsPage'

vi.mock('../../../lib/http', async (original) => ({ ...await original<typeof import('../../../lib/http')>(), apiFetch: vi.fn() }))
beforeEach(() => vi.mocked(apiFetch).mockReset())

it('updates every dashboard card when the selected period changes', async () => {
  const vehicles = [
    { id: 1, label: 'Corolla', brand: 'Toyota', leads: 3 },
    { id: 2, label: 'Focus', brand: 'Ford', leads: 2 },
    { id: 3, label: 'Cronos', brand: 'Fiat', leads: 0 },
  ]
  vi.mocked(apiFetch).mockResolvedValueOnce({ period: 'month', total: 5, vehicles })
    .mockResolvedValueOnce({ period: 'week', total: 1, vehicles: vehicles.map((vehicle) => ({ ...vehicle, leads: vehicle.id === 1 ? 1 : 0 })) })
  render(<LeadsPage />)
  expect(await screen.findByLabelText('Total de contactos')).toHaveTextContent('5')
  expect(screen.getByRole('meter', { name: 'Porcentaje de vehículos contactados' })).toHaveAttribute('value', '67')
  expect(screen.getByRole('meter', { name: 'Contactos de la marca Ford' })).toHaveAttribute('value', '2')
  await userEvent.click(screen.getByRole('button', { name: 'Esta semana' }))
  expect(await screen.findByLabelText('Total de contactos')).toHaveTextContent('1')
  expect(screen.getByRole('meter', { name: 'Porcentaje de vehículos contactados' })).toHaveAttribute('value', '33')
  expect(screen.getByRole('meter', { name: 'Contactos de la marca Toyota' })).toHaveAttribute('value', '1')
  expect(screen.queryByRole('meter', { name: 'Contactos de la marca Ford' })).not.toBeInTheDocument()
  expect(screen.getByRole('meter', { name: 'Contactos de Corolla' })).toHaveAttribute('value', '1')
  expect(screen.getByText(/tu vehículo más consultado/)).toBeInTheDocument()
})

it('keeps summary percentages and brand counts global when only the vehicle ranking changes page', async () => {
  vi.mocked(apiFetch).mockResolvedValue({ period: 'month', total: 12,
    vehicles: Array.from({ length: 12 }, (_, id) => ({ id, label: `Auto ${id}`, brand: 'Ford', leads: 1 })) })
  render(<LeadsPage />)
  await screen.findByLabelText('Total de contactos')
  expect(screen.getByText('Página 1 de 2')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Página siguiente' }))
  expect(screen.getByText('Página 2 de 2')).toBeInTheDocument()
  expect(screen.getByText('Auto 10')).toBeInTheDocument()
  expect(screen.queryByText('Auto 0')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Total de contactos')).toHaveTextContent('12')
  expect(screen.getByRole('meter', { name: 'Contactos de la marca Ford' })).toHaveAttribute('value', '12')
  expect(screen.getByRole('meter', { name: 'Concentración de contactos' })).toHaveAttribute('value', '25')
  await userEvent.selectOptions(screen.getByLabelText('Mostrar'), '25')
  expect(screen.getByText('Página 1 de 1')).toBeInTheDocument()
  expect(screen.getByText('Auto 0')).toBeInTheDocument()
  expect(screen.getByText('Auto 11')).toBeInTheDocument()
  expect(screen.getByLabelText('Total de contactos')).toHaveTextContent('12')
})
