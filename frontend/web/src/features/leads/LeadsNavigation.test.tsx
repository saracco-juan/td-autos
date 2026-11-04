import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { expect, it, vi } from 'vitest'
import { routes } from '../../app/router'
import { useAuth } from '../auth/session/useAuth'
import { fetchLeads } from './api'

vi.mock('../auth/session/useAuth', () => ({ useAuth: vi.fn() }))
vi.mock('../auth/session/AuthProvider', () => ({ default: ({ children }: { children: React.ReactNode }) => children }))
vi.mock('./api', () => ({ fetchLeads: vi.fn() }))
vi.mock('../home/HomeRoute', () => ({ default: () => <p>Buyer home</p> }))
vi.mock('../admin/AdminDashboardPage', () => ({ default: () => <p>Admin home</p> }))

it.each(['pendiente', 'activa'])('opens metrics from the dealer navigation for a %s account', async (state) => {
  vi.mocked(useAuth).mockReturnValue({ status: 'authenticated', user: {
    id: 1, name: 'Dealer', apellido: null, email: 'dealer@example.test', rol: 'concesionaria',
    perfil_completo: true, tiene_diagnostico: false, concesionaria: { id: 1, nombre: 'Dealer', estado_alta: state },
  }, login: vi.fn(), logout: vi.fn(), refresh: vi.fn() })
  vi.mocked(fetchLeads).mockResolvedValue({ period: 'month', total: 0, vehicles: [] })
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/concesionaria/leads'] })} />)
  expect(await screen.findByRole('heading', { level: 1, name: 'Métricas' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Métricas' })).toHaveAttribute('aria-current', 'page')
})

it.each([['comprador', 'Buyer home'], ['administrador', 'Admin home']])('blocks a %s from the dealer leads route', async (role, home) => {
  vi.mocked(useAuth).mockReturnValue({ status: 'authenticated', user: {
    id: 2, name: 'Other', apellido: null, email: 'other@example.test', rol: role,
    perfil_completo: true, tiene_diagnostico: false,
  }, login: vi.fn(), logout: vi.fn(), refresh: vi.fn() })
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/concesionaria/leads'] })} />)
  expect(await screen.findByText(home)).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Métricas' })).not.toBeInTheDocument()
})
