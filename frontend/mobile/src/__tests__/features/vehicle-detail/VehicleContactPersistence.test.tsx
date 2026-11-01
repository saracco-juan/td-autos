import { uuid } from 'expo'
import * as Linking from 'expo-linking'
import * as SecureStore from 'expo-secure-store'
import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library'

import * as authApi from '../../../features/auth/api'
import * as detailApi from '../../../features/vehicle-detail/api'
import * as tokenStorage from '../../../lib/tokenStorage'
import { vehicle } from '@shared/vehicles/fixtures'
import { renderApp } from '../../../test-utils/renderApp'

jest.mock('../../../features/auth/api')
jest.mock('../../../lib/tokenStorage')
jest.mock('expo-linking', () => ({ ...jest.requireActual('expo-linking'), openURL: jest.fn() }))
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }))

const ACTION = 'CONTACTAR POR WHATSAPP'
const LINK = 'https://wa.me/5491155550101?text=Hola'
const APP_LINK = 'whatsapp://send?phone=5491155550101&text=Hola'
const stored = new Map<string, string>()
const leads = new Set<string>()
let buyer = 1
const key = (userId = 1, vehicleId = 7) => `td-autos.whatsapp-contact.${userId}.${vehicleId}`
const reply = () => ({ ok: true, status: 201, text: async () => JSON.stringify({ url: LINK }) }) as Response

// Models the existing backend's buyer/vehicle/attempt uniqueness, not the WhatsApp message send.
function record(path: string | URL | Request, init?: RequestInit) {
  const id = String(path).match(/vehiculos\/(\d+)\/contacto/)?.[1]
  const attempt = JSON.parse(String(init?.body)).attempt_id
  leads.add(`${buyer}:${id}:${attempt}`)
}

async function open(userId = 1, vehicleId = 7) {
  buyer = userId
  jest.mocked(authApi.fetchCurrentUser).mockResolvedValue({ id: userId, name: 'Ana', apellido: null,
    email: 'ana@example.com', rol: 'comprador', tiene_diagnostico: true })
  jest.spyOn(detailApi, 'fetchVehicleDetail').mockResolvedValue({
    vehicle: { ...vehicle, id: vehicleId }, dealer: { id: 3, nombre: 'Autos Sur', provincia: null }, whatsapp_available: true,
  } as Awaited<ReturnType<typeof detailApi.fetchVehicleDetail>>)
  const view = await renderApp(`/vehiculos/${vehicleId}`)
  await screen.findByRole('button', { name: ACTION })
  return view
}

async function contact() {
  await fireEvent.press(screen.getByRole('button', { name: ACTION }))
  await waitFor(() => expect(screen.getByRole('button', { name: ACTION })).not.toBeDisabled())
}

beforeEach(() => {
  jest.resetAllMocks()
  stored.clear()
  leads.clear()
  let sequence = 0
  jest.spyOn(uuid, 'v4').mockImplementation(() => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`)
  jest.mocked(tokenStorage.readToken).mockResolvedValue('tok')
  jest.mocked(SecureStore.getItemAsync).mockImplementation(async (name) => stored.get(name) ?? null)
  jest.mocked(SecureStore.setItemAsync).mockImplementation(async (name, value) => { stored.set(name, value) })
  jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async (name) => { stored.delete(name) })
  jest.mocked(Linking.openURL).mockResolvedValue(true)
  jest.spyOn(globalThis, 'fetch').mockImplementation(async (path, init) => { record(path, init); return reply() })
})

afterEach(() => jest.restoreAllMocks())

it('reuses the saved attempt after closing the app with a committed contact and no response', async () => {
  let resolve!: (response: Response) => void
  jest.mocked(fetch).mockImplementationOnce((path, init) => {
    record(path, init)
    return new Promise((done) => { resolve = done })
  })
  const first = await open()
  await fireEvent.press(screen.getByRole('button', { name: ACTION }))
  await waitFor(() => expect(leads.size).toBe(1))
  const attempt = JSON.parse(String(jest.mocked(fetch).mock.calls[0][1]?.body)).attempt_id
  expect(stored.get(key())).toBe(attempt)
  await first.unmount()
  await open()
  await contact()
  expect(JSON.parse(String(jest.mocked(fetch).mock.calls[1][1]?.body)).attempt_id).toBe(attempt)
  expect(leads.size).toBe(1)
  expect(uuid.v4).toHaveBeenCalledTimes(1)
  expect(Linking.openURL).toHaveBeenCalledWith(APP_LINK)
  expect(stored.has(key())).toBe(false)
  await act(async () => resolve(reply()))
  expect(Linking.openURL).toHaveBeenCalledTimes(1)
  await contact()
  expect(leads.size).toBe(2)
  expect(uuid.v4).toHaveBeenCalledTimes(2)
})

it('retains an attempt across a restart when WhatsApp could not open', async () => {
  jest.mocked(Linking.openURL).mockRejectedValueOnce(new Error('No app'))
  const first = await open()
  await contact()
  const attempt = stored.get(key())
  expect(attempt).toBeDefined()
  await first.unmount()
  await open()
  await contact()
  expect(jest.mocked(fetch).mock.calls.map(([, init]) => JSON.parse(String(init?.body)).attempt_id)).toEqual([attempt, attempt])
  expect(leads.size).toBe(1)
  expect(stored.has(key())).toBe(false)
})

it.each([[2, 7], [1, 8]])('keeps pending attempts isolated for buyer %s and vehicle %s', async (userId, vehicleId) => {
  jest.mocked(Linking.openURL).mockRejectedValueOnce(new Error('No app'))
  const first = await open()
  await contact()
  const original = stored.get(key())
  expect(original).toBeDefined()
  await first.unmount()
  await open(userId, vehicleId)
  await contact()
  expect(JSON.parse(String(jest.mocked(fetch).mock.calls[1][1]?.body)).attempt_id).not.toBe(original)
  expect(stored.get(key())).toBe(original)
  expect(leads.size).toBe(2)
})

it.each(['read', 'write'])('never sends a contact when local storage fails to %s', async (operation) => {
  if (operation === 'read') jest.mocked(SecureStore.getItemAsync).mockRejectedValueOnce(new Error('Locked'))
  else jest.mocked(SecureStore.setItemAsync).mockRejectedValueOnce(new Error('Full'))
  await open()
  await contact()
  expect(screen.getByText('No pudimos iniciar el contacto. Intentá nuevamente.')).toBeOnTheScreen()
  expect(fetch).not.toHaveBeenCalled()
  expect(Linking.openURL).not.toHaveBeenCalled()
  await contact()
  expect(leads.size).toBe(1)
})

it('keeps the saved attempt if clearing it fails after WhatsApp opens', async () => {
  jest.mocked(SecureStore.deleteItemAsync).mockRejectedValueOnce(new Error('Locked'))
  const first = await open()
  await contact()
  expect(Linking.openURL).toHaveBeenCalledTimes(1)
  expect(screen.queryByText('No pudimos abrir WhatsApp. Verificá que esté instalado e intentá nuevamente.')).not.toBeOnTheScreen()
  const attempt = stored.get(key())
  expect(attempt).toBeDefined()
  await first.unmount()
  await open()
  await contact()
  expect(JSON.parse(String(jest.mocked(fetch).mock.calls[1][1]?.body)).attempt_id).toBe(attempt)
  expect(leads.size).toBe(1)
  expect(stored.has(key())).toBe(false)
})

it('saves before posting and shares an unfinished save with a remounted sheet', async () => {
  let save!: () => void
  jest.mocked(SecureStore.setItemAsync).mockImplementationOnce((name, value) => new Promise((done) => {
    save = () => { stored.set(name, value); done() }
  }))
  const first = await open()
  await fireEvent.press(screen.getByRole('button', { name: ACTION }))
  await waitFor(() => expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1))
  expect(fetch).not.toHaveBeenCalled()
  await first.unmount()
  await open()
  await fireEvent.press(screen.getByRole('button', { name: ACTION }))
  await act(async () => save())
  await waitFor(() => expect(screen.getByRole('button', { name: ACTION })).not.toBeDisabled())
  expect(uuid.v4).toHaveBeenCalledTimes(1)
  expect(leads.size).toBe(1)
  expect(Linking.openURL).toHaveBeenCalledTimes(1)
})
