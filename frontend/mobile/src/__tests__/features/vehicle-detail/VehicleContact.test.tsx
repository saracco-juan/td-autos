import { uuid } from 'expo'
import * as Linking from 'expo-linking'
import { router } from 'expo-router'
import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library'

import * as authApi from '../../../features/auth/api'
import * as detailApi from '../../../features/vehicle-detail/api'
import * as costsApi from '../../../features/costs/api'
import * as tokenStorage from '../../../lib/tokenStorage'
import { vehicle } from '@shared/vehicles/fixtures'
import { renderApp } from '../../../test-utils/renderApp'

jest.mock('../../../features/auth/api')
jest.mock('../../../lib/tokenStorage')
jest.mock('../../../features/costs/api')
jest.mock('expo-linking', () => ({ ...jest.requireActual('expo-linking'), openURL: jest.fn() }))

const ATTEMPT = 'e632c7df-1411-448f-82b1-e65ad9a760ac'
const TEXT = encodeURIComponent('Me interesa el Citroën C4 Feel & Pack 2021. ¿Más información?')
const LINK = `https://wa.me/5491155550101?text=${TEXT}`
const APP_LINK = `whatsapp://send?phone=5491155550101&text=${TEXT}`
const ACTION = 'CONTACTAR POR WHATSAPP'
const reply = (status = 201) => ({ ok: status < 400, status,
  text: async () => JSON.stringify(status < 400 ? { url: LINK } : {}),
}) as Response

async function open(available = true) {
  jest.spyOn(detailApi, 'fetchVehicleDetail').mockResolvedValue({
    vehicle, dealer: { id: 3, nombre: 'Autos Sur', provincia: null }, whatsapp_available: available,
  } as Awaited<ReturnType<typeof detailApi.fetchVehicleDetail>>)
  const view = await renderApp('/vehiculos/7')
  await screen.findByText('FICHA TÉCNICA')
  return view
}

beforeEach(() => {
  jest.resetAllMocks()
  jest.mocked(tokenStorage.readToken).mockResolvedValue('tok')
  jest.mocked(authApi.fetchCurrentUser).mockResolvedValue({ id: 1, name: 'Ana', apellido: null,
    email: 'ana@example.com', rol: 'comprador', tiene_diagnostico: true })
  jest.spyOn(uuid, 'v4').mockReturnValue(ATTEMPT)
  jest.mocked(Linking.openURL).mockResolvedValue(true)
  jest.spyOn(globalThis, 'fetch').mockResolvedValue(reply())
})

afterEach(() => jest.restoreAllMocks())

it('TC-65 / TC-66: records contact before opening only WhatsApp with the server message', async () => {
  let resolve!: (response: Response) => void
  jest.mocked(fetch).mockReturnValue(new Promise((done) => { resolve = done }))
  const view = await open()
  const button = screen.getByRole('button', { name: ACTION })
  expect(button).toHaveStyle({ height: 40, borderRadius: 10, borderColor: '#a9d8bc', backgroundColor: '#ffffff' })
  expect(screen.getByText(ACTION)).toHaveStyle({ color: '#17803a', fontSize: 11, fontWeight: '700' })
  await fireEvent.press(button)
  await fireEvent.press(button)
  expect(button).toBeDisabled()
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/vehiculos/7/contacto'), {
    method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: 'Bearer tok' },
    body: JSON.stringify({ attempt_id: ATTEMPT }),
  })
  expect(Linking.openURL).not.toHaveBeenCalled()
  await act(async () => resolve(reply()))
  await waitFor(() => expect(Linking.openURL).toHaveBeenCalledWith(APP_LINK))
  expect(view.getPathname()).toBe('/vehiculos/7')
  expect(screen.getByRole('button', { name: ACTION })).not.toBeDisabled()
  // Closing WhatsApp without sending needs no confirmation or additional API call.
  expect(fetch).toHaveBeenCalledTimes(1)
})

it('reuses the attempt after an uncertain response and starts a new one after a successful handoff', async () => {
  jest.mocked(fetch).mockRejectedValueOnce(new Error('Connection lost'))
  await open()
  await fireEvent.press(screen.getByRole('button', { name: ACTION }))
  expect(await screen.findByText('No pudimos iniciar el contacto. Intentá nuevamente.')).toBeOnTheScreen()
  expect(Linking.openURL).not.toHaveBeenCalled()
  await waitFor(() => expect(screen.getByRole('button', { name: ACTION })).not.toBeDisabled())
  await fireEvent.press(screen.getByRole('button', { name: ACTION }))
  await waitFor(() => expect(Linking.openURL).toHaveBeenCalledWith(APP_LINK))
  expect(jest.mocked(fetch).mock.calls[0][1]?.body).toBe(jest.mocked(fetch).mock.calls[1][1]?.body)
  expect(uuid.v4).toHaveBeenCalledTimes(1)
  await waitFor(() => expect(screen.getByRole('button', { name: ACTION })).not.toBeDisabled())
  await fireEvent.press(screen.getByRole('button', { name: ACTION }))
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3))
  expect(uuid.v4).toHaveBeenCalledTimes(2)
  await waitFor(() => expect(screen.getByRole('button', { name: ACTION })).not.toBeDisabled())
})

it('shows an inline notice without browser fallback and retries opening without another lead', async () => {
  jest.mocked(Linking.openURL).mockRejectedValueOnce(new Error('No app'))
  await open()
  await fireEvent.press(screen.getByRole('button', { name: ACTION }))
  expect(await screen.findByText('No pudimos abrir WhatsApp. Verificá que esté instalado e intentá nuevamente.')).toBeOnTheScreen()
  await waitFor(() => expect(screen.getByRole('button', { name: ACTION })).not.toBeDisabled())
  await fireEvent.press(screen.getByRole('button', { name: ACTION }))
  await waitFor(() => expect(Linking.openURL).toHaveBeenCalledTimes(2))
  expect(Linking.openURL).toHaveBeenNthCalledWith(2, APP_LINK)
  expect(fetch).toHaveBeenCalledTimes(1)
  await waitFor(() => expect(screen.getByRole('button', { name: ACTION })).not.toBeDisabled())
})

it.each([[409, 'WhatsApp no disponible'], [404, 'Esta publicación ya no está disponible.'],
  [500, 'No pudimos iniciar el contacto. Intentá nuevamente.']])('keeps the sheet and never opens WhatsApp on HTTP %s', async (status, message) => {
  jest.mocked(fetch).mockResolvedValue(reply(status as number))
  await open()
  await fireEvent.press(screen.getByRole('button', { name: ACTION }))
  expect(await screen.findByText(message as string)).toBeOnTheScreen()
  expect(Linking.openURL).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'CALCULAR COSTOS' })).toBeOnTheScreen()
})

it('shows unavailable without offering contact when the dealership has no usable phone', async () => {
  await open(false)
  expect(screen.getByText('WhatsApp no disponible')).toBeOnTheScreen()
  expect(screen.queryByRole('button', { name: ACTION })).not.toBeOnTheScreen()
  expect(fetch).not.toHaveBeenCalled()
})

it('ignores a late contact response after leaving the vehicle sheet', async () => {
  let resolve!: (response: Response) => void
  jest.mocked(fetch).mockReturnValue(new Promise((done) => { resolve = done }))
  const view = await open()
  await fireEvent.press(screen.getByRole('button', { name: ACTION }))
  await view.unmount()
  await act(async () => resolve(reply()))
  expect(Linking.openURL).not.toHaveBeenCalled()
})

it('does not open a late contact on another screen and permits reopening the saved contact on return', async () => {
  let resolve!: (response: Response) => void
  jest.mocked(fetch).mockReturnValue(new Promise((done) => { resolve = done }))
  jest.mocked(costsApi.fetchCosts).mockReturnValue(new Promise(() => {}))
  const view = await open()
  await fireEvent.press(screen.getByRole('button', { name: ACTION }))
  await fireEvent.press(screen.getByRole('button', { name: 'CALCULAR COSTOS' }))
  await waitFor(() => expect(view.getPathname()).toBe('/vehiculos/7/costos'))
  await act(async () => resolve(reply()))
  expect(Linking.openURL).not.toHaveBeenCalled()
  await act(() => router.navigate('/vehiculos/7'))
  await waitFor(() => expect(screen.getByRole('button', { name: ACTION })).not.toBeDisabled())
  await fireEvent.press(screen.getByRole('button', { name: ACTION }))
  await waitFor(() => expect(Linking.openURL).toHaveBeenCalledWith(APP_LINK))
  expect(fetch).toHaveBeenCalledTimes(1)
})
