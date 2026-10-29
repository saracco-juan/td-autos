import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { expect, it, vi } from 'vitest'
import { vehicle } from '@shared/vehicles/fixtures'
import { apiFetch } from '../../lib/http'
import VehicleDetailPage from './VehicleDetailPage'

vi.mock('../../lib/http', async (original) => ({ ...await original<object>(), apiFetch: vi.fn() }))

it('uses the shared heart and returns to favorites without recommendation ranking context', async () => {
  vi.mocked(apiFetch).mockResolvedValue({
    vehicle,
    dealer: { id: 2, nombre: 'Autos del Sur', provincia: 'CABA' },
    is_favorite: false,
  })
  render(<MemoryRouter initialEntries={[{ pathname: '/vehiculos/7', state: { returnTo: '/favoritos' } }]}>
    <Routes><Route path="/vehiculos/:id" element={<VehicleDetailPage />} /></Routes>
  </MemoryRouter>)

  expect(await screen.findByRole('heading', { name: 'Toyota Corolla XEI 2021' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Volver a favoritos' })).toHaveAttribute('href', '/favoritos')
  const button = screen.getByRole('button', { name: 'Guardar Toyota Corolla XEI 2021 en favoritos' })
  await userEvent.click(button)
  expect(apiFetch).toHaveBeenLastCalledWith('/api/favoritos/7', { method: 'PUT' })
})

it('ignores arbitrary return destinations', async () => {
  vi.mocked(apiFetch).mockResolvedValue({ vehicle, dealer: { id: 2, nombre: 'Autos del Sur', provincia: 'CABA' } })
  render(<MemoryRouter initialEntries={[{ pathname: '/vehiculos/7', state: { returnTo: '/admin' } }]}>
    <Routes><Route path="/vehiculos/:id" element={<VehicleDetailPage />} /></Routes>
  </MemoryRouter>)
  expect(await screen.findByRole('link', { name: 'Volver a recomendados' })).toHaveAttribute('href', '/recomendaciones')
})
