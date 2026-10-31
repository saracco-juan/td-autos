import { act, fireEvent, screen } from 'expo-router/testing-library'

import * as authApi from '../../../features/auth/api'
import { apiFetch, NetworkError } from '../../../lib/http'
import * as tokenStorage from '../../../lib/tokenStorage'
import * as matchingApi from '../../../features/recommendations/api'
import { vehicle } from '@shared/vehicles/fixtures'
import type { FavoritesResponse } from '@shared/favorites/types'
import { renderApp } from '../../../test-utils/renderApp'
import { ready, recommendation } from '../../../test-utils/recommendations'

jest.mock('../../../features/auth/api')
jest.mock('../../../features/recommendations/api')
jest.mock('../../../lib/tokenStorage')
jest.mock('../../../lib/http', () => ({ ...jest.requireActual('../../../lib/http'), apiFetch: jest.fn() }))

const request = jest.mocked(apiFetch)
const saved = { ...vehicle, image_url: 'https://example.com/car.jpg' }
const response = (items = [saved]): FavoritesResponse => ({ data: items,
  meta: { current_page: 1, per_page: 6, last_page: 1, total: items.length } })

beforeEach(() => {
  jest.resetAllMocks()
  jest.mocked(tokenStorage).readToken.mockResolvedValue('tok')
  jest.mocked(authApi).fetchCurrentUser.mockResolvedValue({ id: 1, name: 'Ana', apellido: null,
    email: 'ana@example.com', rol: 'comprador', tiene_diagnostico: true })
  jest.mocked(matchingApi).fetchRecommendations.mockReturnValue(new Promise(() => {}))
  request.mockResolvedValue(response())
})

it('RF10: reads persisted favorites with the session token without waiting for matching', async () => {
  await renderApp('/favoritos')
  expect(await screen.findByRole('header', { name: 'Toyota Corolla XEI 2021' })).toBeOnTheScreen()
  expect(screen.getByText('1 vehículo guardado')).toBeOnTheScreen()
  expect(request).toHaveBeenCalledWith('/api/favoritos?page=1&per_page=6', { token: 'tok' })
  expect(screen.getByText('Compatibilidad no disponible')).toBeOnTheScreen()
  expect(screen.getByRole('button', { name: 'VER FICHA' })).toBeOnTheScreen()
  expect(screen.getByRole('button', { name: /^Favoritos,/ })).toBeOnTheScreen()
})

it('TC-34 favorites: shows a clear empty state without an error and links to recommendations', async () => {
  request.mockResolvedValue(response([]))
  const view = await renderApp('/favoritos')
  expect(await screen.findByText('Todavía no guardaste vehículos')).toBeOnTheScreen()
  expect(screen.queryByRole('alert')).not.toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: 'VER RECOMENDADOS' }))
  expect(view.getPathname()).toBe('/recomendados')
})

it('keeps loading local and offers retry after a network failure', async () => {
  request.mockReturnValueOnce(new Promise(() => {}))
  const view = await renderApp('/favoritos')
  expect(await screen.findByLabelText('Cargando')).toBeOnTheScreen()
  expect(screen.getByRole('header', { name: 'Vehículos guardados' })).toBeOnTheScreen()
  await view.unmount()
  request.mockRejectedValueOnce(new NetworkError('offline'))
  await renderApp('/favoritos')
  expect(await screen.findByText('Sin conexión con el servidor')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: 'REINTENTAR' }))
  expect(await screen.findByText('1 vehículo guardado')).toBeOnTheScreen()
})

it('replaces a broken photo instead of keeping a broken image', async () => {
  await renderApp('/favoritos')
  const image = await screen.findByLabelText('Foto de Toyota Corolla XEI 2021')
  await fireEvent(image, 'error', {})
  expect(screen.getByText('Imagen no disponible')).toBeOnTheScreen()
})

it('waits for an ongoing save before reading favorites after navigation', async () => {
  let finish!: () => void
  let persisted = false
  request.mockImplementation((path) => path.endsWith('/7')
    ? new Promise<void>((resolve) => { finish = () => { persisted = true; resolve() } })
    : Promise.resolve(response(persisted ? [saved] : [])))
  jest.mocked(matchingApi).fetchRecommendations.mockResolvedValue(ready([recommendation(7)]))
  await renderApp('/recomendados')
  await fireEvent.press(await screen.findByRole('button', { name: /Guardar .* en favoritos/ }))
  await fireEvent.press(screen.getByRole('button', { name: /^Favoritos,/ }))
  expect(request).not.toHaveBeenCalledWith('/api/favoritos?page=1&per_page=6', { token: 'tok' })
  expect(screen.getByLabelText('Cargando')).toBeOnTheScreen()
  await act(async () => finish())
  expect(await screen.findByRole('header', { name: 'Toyota Corolla XEI 2021' })).toBeOnTheScreen()
})

it('an earlier response cannot overwrite a newer visit', async () => {
  let oldResolve!: (value: FavoritesResponse) => void
  let newResolve!: (value: FavoritesResponse) => void
  let count = 0
  request.mockImplementation((path) => {
    if (!path.startsWith('/api/favoritos?')) return Promise.resolve(response())
    count += 1
    return new Promise<FavoritesResponse>((resolve) => {
      if (count === 1) oldResolve = resolve
      else newResolve = resolve
    })
  })
  const view = await renderApp('/favoritos')
  expect(await screen.findByLabelText('Cargando')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: 'VER RECOMENDADOS' }))
  expect(view.getPathname()).toBe('/recomendados')
  await fireEvent.press(screen.getByRole('button', { name: /^Favoritos,/ }))
  expect(view.getPathname()).toBe('/favoritos')
  expect(count).toBe(2)
  await act(async () => newResolve(response([])))
  expect(await screen.findByText('Todavía no guardaste vehículos')).toBeOnTheScreen()
  await act(async () => oldResolve(response([saved])))
  expect(screen.getByText('Todavía no guardaste vehículos')).toBeOnTheScreen()
  expect(screen.queryByRole('header', { name: 'Toyota Corolla XEI 2021' })).not.toBeOnTheScreen()
})

it('optional ranking failure leaves persisted favorites usable', async () => {
  jest.mocked(matchingApi).fetchRecommendations.mockRejectedValue(new Error('ranking unavailable'))
  await renderApp('/favoritos')
  expect(await screen.findByRole('header', { name: 'Toyota Corolla XEI 2021' })).toBeOnTheScreen()
  expect(screen.getByText('Compatibilidad no disponible')).toBeOnTheScreen()
  expect(screen.getByRole('button', { name: 'VER FICHA' })).toBeOnTheScreen()
  expect(screen.queryByRole('alert')).not.toBeOnTheScreen()
})

it('failed pending save settles before favorites reads persisted empty list', async () => {
  let failSave!: (error: Error) => void
  request.mockImplementation((path) => path.endsWith('/7')
    ? new Promise<void>((_, reject) => { failSave = reject })
    : Promise.resolve(response([])))
  jest.mocked(matchingApi).fetchRecommendations.mockResolvedValue(ready([recommendation(7)]))
  await renderApp('/recomendados')
  await fireEvent.press(await screen.findByRole('button', { name: /Guardar .* en favoritos/ }))
  await fireEvent.press(screen.getByRole('button', { name: /^Favoritos,/ }))
  expect(request).not.toHaveBeenCalledWith('/api/favoritos?page=1&per_page=6', { token: 'tok' })
  expect(screen.getByLabelText('Cargando')).toBeOnTheScreen()
  await act(async () => failSave(new Error('offline')))
  expect(await screen.findByText('Todavía no guardaste vehículos')).toBeOnTheScreen()
  expect(request).toHaveBeenCalledWith('/api/favoritos?page=1&per_page=6', { token: 'tok' })
})
