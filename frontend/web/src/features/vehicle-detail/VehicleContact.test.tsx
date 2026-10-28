import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { vehicle } from '@shared/vehicles/fixtures'
import { apiFetch, HttpError } from '../../lib/http'
import VehicleDetailPage from './VehicleDetailPage'

vi.mock('../../lib/http', async (original) => ({ ...await original<object>(), apiFetch: vi.fn() }))
const response = { vehicle, dealer: { id: 2, nombre: 'Autos del Sur', provincia: 'CABA' }, whatsapp_available: true }
const url = 'https://wa.me/5491155550101?text=Consulta'
const mount = () => render(<MemoryRouter initialEntries={['/vehiculos/7']}>
  <Routes><Route path="/vehiculos/:id" element={<VehicleDetailPage />} /></Routes>
</MemoryRouter>)

beforeEach(() => {
  vi.mocked(apiFetch).mockReset().mockResolvedValueOnce(response)
  vi.spyOn(window, 'open').mockReturnValue(null)
})
afterEach(() => vi.restoreAllMocks())

it('TC65/TC66 persists contact before opening only WhatsApp, without relying on sending', async () => {
  let complete!: (value: { url: string }) => void
  vi.mocked(apiFetch).mockReset().mockResolvedValueOnce(response)
    .mockImplementationOnce(() => new Promise((resolve) => { complete = resolve }))
  mount()
  const button = await screen.findByRole('button', { name: 'CONTACTAR POR WHATSAPP' })
  await userEvent.click(button)
  expect(apiFetch).toHaveBeenLastCalledWith('/api/vehiculos/7/contacto', { method: 'POST' })
  expect(button).toBeDisabled()
  expect(window.open).not.toHaveBeenCalled()
  await act(async () => { complete({ url }) })
  expect(window.open).toHaveBeenCalledExactlyOnceWith(url, '_self', 'noopener,noreferrer')
})

it('shows unavailable and never creates a lead for an unconfirmed destination', async () => {
  vi.mocked(apiFetch).mockReset().mockResolvedValue({ ...response, whatsapp_available: false })
  mount()
  expect(await screen.findByText('WhatsApp no disponible')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'CONTACTAR POR WHATSAPP' })).not.toBeInTheDocument()
  expect(apiFetch).toHaveBeenCalledTimes(1)
  expect(window.open).not.toHaveBeenCalled()
})

it('keeps the detail and lets the buyer retry a failed lead request', async () => {
  vi.mocked(apiFetch).mockRejectedValueOnce(new HttpError(500, {})).mockResolvedValueOnce({ url })
  mount()
  await userEvent.click(await screen.findByRole('button', { name: 'CONTACTAR POR WHATSAPP' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos iniciar el contacto. Intentá nuevamente.')
  expect(window.open).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'CONTACTAR POR WHATSAPP' }))
  expect(window.open).toHaveBeenCalledWith(url, '_self', 'noopener,noreferrer')
})

it('does not navigate from a detail that was closed while recording contact', async () => {
  let complete!: (value: { url: string }) => void
  vi.mocked(apiFetch).mockImplementationOnce(() => new Promise((resolve) => { complete = resolve }))
  const view = mount()
  await userEvent.click(await screen.findByRole('button', { name: 'CONTACTAR POR WHATSAPP' }))
  view.unmount()
  await act(async () => { complete({ url }) })
  expect(window.open).not.toHaveBeenCalled()
})
