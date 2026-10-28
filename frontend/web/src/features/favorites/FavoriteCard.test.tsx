import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { expect, it, vi } from 'vitest'
import type { FavoriteVehicle } from '@shared/favorites/types'
import FavoriteCard from './FavoriteCard'

const vehicle: FavoriteVehicle = {
  id: 12, marca: 'Toyota', modelo: 'Corolla', version: 'XEI', anio: 2021,
  precio: 28900000, moneda: 'ARS', kilometraje: 62000, transmision: 'automatica',
  combustible: 'nafta', ubicacion: 'CABA', image_url: null,
}

it('formats public facts and exposes removal and detail actions', async () => {
  const remove = vi.fn()
  render(<MemoryRouter><FavoriteCard vehicle={vehicle} busy={false} onRemove={remove} /></MemoryRouter>)
  expect(screen.getByText('$ 28.900.000')).toBeInTheDocument()
  expect(screen.getByText('Automática · Nafta · 62.000 km')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'VER FICHA' })).toHaveAttribute('href', '/vehiculos/12')
  await userEvent.click(screen.getByRole('button', { name: 'QUITAR' }))
  expect(remove).toHaveBeenCalledOnce()
})

it('renders unknown facts without inventing zero amounts or crashing', () => {
  render(<MemoryRouter><FavoriteCard vehicle={{ ...vehicle, precio: null, moneda: null,
    kilometraje: null, transmision: null, combustible: null }} busy={false} onRemove={vi.fn()} /></MemoryRouter>)
  expect(screen.getByText('Precio no disponible')).toBeInTheDocument()
  expect(screen.getByText('Kilometraje no disponible')).toBeInTheDocument()
  expect(screen.getByText('Imagen no disponible')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'QUITAR' })).toBeEnabled()
})
