import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library'

import * as authApi from '../../../features/auth/api'
import * as detailApi from '../../../features/vehicle-detail/api'
import * as recommendationsApi from '../../../features/recommendations/api'
import * as tokenStorage from '../../../lib/tokenStorage'
import { apiFetch } from '../../../lib/http'
import { vehicle } from '@shared/vehicles/fixtures'
import { ready, recommendation } from '../../../test-utils/recommendations'
import { renderApp } from '../../../test-utils/renderApp'

jest.mock('../../../features/auth/api')
jest.mock('../../../features/vehicle-detail/api')
jest.mock('../../../features/recommendations/api')
jest.mock('../../../lib/tokenStorage')
jest.mock('../../../lib/http', () => ({ ...jest.requireActual('../../../lib/http'), apiFetch: jest.fn() }))

const request = jest.mocked(apiFetch)
const title = 'Toyota Corolla XEI 2021'
const saveLabel = `Guardar ${title} en favoritos`
const removeLabel = `Quitar ${title} de favoritos`

beforeEach(() => {
  jest.resetAllMocks()
  jest.mocked(tokenStorage).readToken.mockResolvedValue('tok')
  jest.mocked(authApi).fetchCurrentUser.mockResolvedValue({ id: 1, name: 'Ana', apellido: null,
    email: 'ana@example.com', rol: 'comprador', tiene_diagnostico: true })
  jest.mocked(detailApi).fetchVehicleDetail.mockResolvedValue({ vehicle,
    dealer: { id: 3, nombre: 'Autos Sur', provincia: null } })
  request.mockResolvedValue(undefined)
})

it('TC-31: saves from the vehicle sheet immediately, blocks repeat taps and persists with the session token', async () => {
  let finish!: () => void
  request.mockReturnValue(new Promise<void>((resolve) => { finish = resolve }))
  await renderApp('/vehiculos/7')
  await fireEvent.press(await screen.findByRole('button', { name: saveLabel }))
  const saved = screen.getByRole('button', { name: removeLabel })
  expect(saved).toBeSelected()
  expect(saved).toBeDisabled()
  await fireEvent.press(saved)
  expect(request).toHaveBeenCalledTimes(1)
  expect(request).toHaveBeenCalledWith('/api/favoritos/7', { method: 'PUT', token: 'tok' })
  await act(async () => finish())
  await waitFor(() => expect(saved).toBeEnabled())
})

it('TC-32: honors the persisted saved state after reopening and removes from the sheet', async () => {
  jest.mocked(detailApi).fetchVehicleDetail.mockResolvedValue({ vehicle,
    dealer: { id: 3, nombre: 'Autos Sur', provincia: null }, is_favorite: true })
  await renderApp('/vehiculos/7')
  await fireEvent.press(await screen.findByRole('button', { name: removeLabel }))
  expect(request).toHaveBeenCalledWith('/api/favoritos/7', { method: 'DELETE', token: 'tok' })
  expect(screen.getByRole('button', { name: saveLabel })).not.toBeSelected()
})

it('restores the previous state when saving fails and allows retry', async () => {
  request.mockRejectedValueOnce(new Error('offline'))
  await renderApp('/vehiculos/7')
  await fireEvent.press(await screen.findByRole('button', { name: saveLabel }))
  expect(await screen.findByText('No se pudo actualizar el favorito. Intentá de nuevo.')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: saveLabel }))
  expect(await screen.findByRole('button', { name: removeLabel })).toBeOnTheScreen()
  expect(request).toHaveBeenCalledTimes(2)
})

it('TC-31: uses the same heart from recommendations without changing existing comparison/detail actions', async () => {
  const result = recommendation(7)
  jest.mocked(recommendationsApi).fetchRecommendations.mockResolvedValue(ready([result]))
  await renderApp('/recomendados')
  await fireEvent.press(await screen.findByRole('button', { name: /Guardar .* en favoritos/ }))
  expect(request).toHaveBeenCalledWith('/api/favoritos/7', { method: 'PUT', token: 'tok' })
  expect(screen.getByRole('button', { name: 'VER FICHA' })).toBeOnTheScreen()
  expect(screen.getByRole('button', { name: 'COMPARAR' })).toBeOnTheScreen()
})

it.each([true, false])('keeps both hearts consistent across navigation while saving (success=%s)', async (success) => {
  let finish!: () => void
  request.mockReturnValue(new Promise<void>((resolve, reject) => {
    finish = () => success ? resolve() : reject(new Error('offline'))
  }))
  jest.mocked(recommendationsApi).fetchRecommendations.mockResolvedValue(ready([recommendation(7)]))
  await renderApp('/recomendados')
  await fireEvent.press(await screen.findByRole('button', { name: /Guardar .* en favoritos/ }))
  await fireEvent.press(screen.getByRole('button', { name: 'VER FICHA' }))
  const heart = await screen.findByRole('button', { name: removeLabel })
  expect(heart).toBeSelected()
  expect(heart).toBeDisabled()
  await fireEvent.press(heart)
  expect(request).toHaveBeenCalledTimes(1)
  await act(async () => finish())
  expect(screen.getByRole('button', { name: success ? removeLabel : saveLabel })).toBeEnabled()
  await fireEvent.press(screen.getByRole('link', { name: 'Volver a recomendados' }))
  expect(await screen.findByRole('button', { name: success ? /Quitar .* de favoritos/ : /Guardar .* en favoritos/ })).toBeEnabled()
})

it('restores a rejected removal and permits one retry without duplicate requests', async () => {
  let fail!: (error: Error) => void
  request.mockReturnValueOnce(new Promise<void>((_, reject) => { fail = reject }))
  jest.mocked(detailApi).fetchVehicleDetail.mockResolvedValue({ vehicle,
    dealer: { id: 3, nombre: 'Autos Sur', provincia: null }, is_favorite: true })
  await renderApp('/vehiculos/7')
  await fireEvent.press(await screen.findByRole('button', { name: removeLabel }))
  const unsaved = screen.getByRole('button', { name: saveLabel })
  expect(unsaved).toBeDisabled()
  await fireEvent.press(unsaved)
  expect(request).toHaveBeenCalledTimes(1)
  expect(request).toHaveBeenCalledWith('/api/favoritos/7', { method: 'DELETE', token: 'tok' })
  await act(async () => fail(new Error('offline')))
  expect(await screen.findByText('No se pudo actualizar el favorito. Intentá de nuevo.')).toBeOnTheScreen()
  const restored = screen.getByRole('button', { name: removeLabel })
  expect(restored).toBeSelected()
  await fireEvent.press(restored)
  await waitFor(() => expect(request).toHaveBeenCalledTimes(2))
})
