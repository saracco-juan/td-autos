import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { apiFetch, HttpError } from '../../lib/http'
import { useAuth } from '../auth/session/useAuth'
import DealerStatusPage from './DealerStatusPage'

vi.mock('../../lib/http', async (original) => ({ ...await original<object>(), apiFetch: vi.fn() }))
vi.mock('../auth/session/useAuth', () => ({ useAuth: vi.fn() }))
vi.mock('../subscription/api', () => ({ fetchSubscription: vi.fn() }))
const endpoint = '/api/concesionaria/contacto'
const mount = (rol = 'concesionaria') => {
  vi.mocked(useAuth).mockReturnValue({ user: { id: 1, name: 'Ana', apellido: 'Pérez', rol,
    email: 'ana@example.com', perfil_completo: true, tiene_diagnostico: false }, status: 'authenticated',
    login: vi.fn(), logout: vi.fn(), refresh: vi.fn() })
  render(<DealerStatusPage />)
}

const openContact = () => userEvent.click(screen.getByRole('button', { name: 'EDITAR CONTACTO' }))

beforeEach(() => vi.mocked(apiFetch).mockReset())

it('loads and updates the dealership public phone without submitting a dealer identity', async () => {
  vi.mocked(apiFetch).mockResolvedValueOnce({ telefono_publico: '5491155550101' })
    .mockResolvedValueOnce({ telefono_publico: '5491155550202' })
  mount()
  await openContact()
  const field = await screen.findByLabelText('Teléfono público / WhatsApp')
  await screen.findByDisplayValue('5491155550101')
  await userEvent.clear(field)
  await userEvent.type(field, '+54 9 11 5555-0202')
  await userEvent.click(screen.getByRole('button', { name: 'GUARDAR TELÉFONO' }))
  expect(await screen.findByRole('status')).toHaveTextContent('El teléfono se guardó.')
  expect(apiFetch).toHaveBeenLastCalledWith(endpoint, { method: 'PUT', body: { telefono_publico: '+54 9 11 5555-0202' } })
  expect(field).toHaveValue('5491155550202')
})

it('allows clearing the phone and shows validation errors without reporting success', async () => {
  vi.mocked(apiFetch).mockResolvedValueOnce({ telefono_publico: '5491155550101' })
    .mockRejectedValueOnce(new HttpError(422, { errors: { telefono_publico: ['Número inválido.'] } }))
    .mockResolvedValueOnce({ telefono_publico: null })
  mount()
  await openContact()
  const field = await screen.findByDisplayValue('5491155550101')
  await userEvent.clear(field)
  await userEvent.type(field, '123')
  await userEvent.click(screen.getByRole('button', { name: 'GUARDAR TELÉFONO' }))
  expect(await screen.findByText('Número inválido.')).toBeInTheDocument()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  await userEvent.clear(field)
  await userEvent.click(screen.getByRole('button', { name: 'GUARDAR TELÉFONO' }))
  expect(await screen.findByRole('status')).toHaveTextContent('El teléfono se guardó.')
  expect(apiFetch).toHaveBeenLastCalledWith(endpoint, { method: 'PUT', body: { telefono_publico: '' } })
})

it('lets a failed load be retried and prevents saving an unknown phone', async () => {
  vi.mocked(apiFetch).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ telefono_publico: null })
  mount()
  await openContact()
  expect(await screen.findByRole('button', { name: 'REINTENTAR' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'GUARDAR TELÉFONO' })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'REINTENTAR' }))
  expect(await screen.findByLabelText('Teléfono público / WhatsApp')).toHaveValue('')
})

it.each(['comprador', 'administrador'])('does not request or display dealership settings to %s', (role) => {
  mount(role)
  expect(screen.queryByLabelText('Teléfono público / WhatsApp')).not.toBeInTheDocument()
  expect(apiFetch).not.toHaveBeenCalled()
})
