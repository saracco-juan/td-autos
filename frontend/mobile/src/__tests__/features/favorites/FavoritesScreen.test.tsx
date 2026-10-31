import { act, fireEvent, screen } from 'expo-router/testing-library'

import * as authApi from '../../../features/auth/api'
import { apiFetch, HttpError, NetworkError } from '../../../lib/http'
import * as tokenStorage from '../../../lib/tokenStorage'
import * as matchingApi from '../../../features/recommendations/api'
import * as detailApi from '../../../features/vehicle-detail/api'
import { vehicle } from '@shared/vehicles/fixtures'
import type { FavoritesResponse } from '@shared/favorites/types'
import { renderApp } from '../../../test-utils/renderApp'
import { ready, recommendation } from '../../../test-utils/recommendations'

jest.mock('../../../features/auth/api')
jest.mock('../../../features/recommendations/api')
jest.mock('../../../features/vehicle-detail/api')
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
  jest.mocked(detailApi).fetchVehicleDetail.mockResolvedValue({ vehicle,
    dealer: { id: 3, nombre: 'Autos Sur', provincia: null }, is_favorite: true })
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

it('TC-32: removes a saved vehicle and persists Deshacer through the same API', async () => {
  let items = [saved]
  request.mockImplementation((_, options) => {
    if (options?.method === 'DELETE') items = []
    if (options?.method === 'PUT') items = [saved]
    return Promise.resolve(options?.method ? undefined : response(items))
  })
  await renderApp('/favoritos')
  await fireEvent.press(await screen.findByRole('button', { name: 'QUITAR' }))
  expect(await screen.findByText('Todavía no guardaste vehículos')).toBeOnTheScreen()
  expect(request).toHaveBeenCalledWith('/api/favoritos/7', { method: 'DELETE', token: 'tok' })
  await fireEvent.press(screen.getByRole('button', { name: 'DESHACER' }))
  expect(await screen.findByRole('header', { name: 'Toyota Corolla XEI 2021' })).toBeOnTheScreen()
  expect(request).toHaveBeenCalledWith('/api/favoritos/7', { method: 'PUT', token: 'tok' })
})

it('keeps Deshacer available when restoring the removed vehicle fails', async () => {
  let items = [saved]
  request.mockImplementation((_, options) => {
    if (options?.method === 'DELETE') items = []
    if (options?.method === 'PUT') items = [saved]
    return Promise.resolve(options?.method ? undefined : response(items))
  })
  await renderApp('/favoritos')
  await fireEvent.press(await screen.findByRole('button', { name: 'QUITAR' }))
  await screen.findByText('Todavía no guardaste vehículos')
  request.mockRejectedValueOnce(new Error('unavailable'))
  await fireEvent.press(screen.getByRole('button', { name: 'DESHACER' }))
  expect(await screen.findByText('No pudimos actualizar tus favoritos. Intentá nuevamente.')).toBeOnTheScreen()
  expect(screen.getByRole('button', { name: 'DESHACER' })).toBeEnabled()
  await fireEvent.press(screen.getByRole('button', { name: 'DESHACER' }))
  expect(await screen.findByRole('header', { name: 'Toyota Corolla XEI 2021' })).toBeOnTheScreen()
})

it('keeps the saved vehicle after a failed list removal and permits retry', async () => {
  await renderApp('/favoritos')
  await screen.findByText('1 vehículo guardado')
  request.mockRejectedValueOnce(new Error('offline'))
  await fireEvent.press(screen.getByRole('button', { name: 'QUITAR' }))
  expect(await screen.findByText('No pudimos actualizar tus favoritos. Intentá nuevamente.')).toBeOnTheScreen()
  expect(await screen.findByRole('header', { name: 'Toyota Corolla XEI 2021' })).toBeOnTheScreen()
  expect(screen.queryByRole('button', { name: 'DESHACER' })).not.toBeOnTheScreen()
  request.mockResolvedValueOnce(undefined).mockResolvedValueOnce(response([]))
  await fireEvent.press(screen.getByRole('button', { name: 'QUITAR' }))
  expect(await screen.findByText('Todavía no guardaste vehículos')).toBeOnTheScreen()
})

it('pages and changes size, then returns to the previous page when removing its last item', async () => {
  let items = Array.from({ length: 7 }, (_, index) => ({ ...saved, id: index + 1, modelo: `Modelo ${index + 1}` }))
  request.mockImplementation((path, options) => {
    if (options?.method === 'DELETE') {
      items = items.filter((item) => item.id !== Number(path.split('/').at(-1)))
      return Promise.resolve(undefined)
    }
    const query = new URLSearchParams(path.split('?')[1])
    const page = Number(query.get('page'))
    const size = Number(query.get('per_page'))
    return Promise.resolve({ data: items.slice((page - 1) * size, page * size),
      meta: { current_page: page, per_page: size, total: items.length, last_page: Math.ceil(items.length / size) } })
  })
  await renderApp('/favoritos')
  await fireEvent.press(await screen.findByRole('button', { name: 'Página 2' }))
  expect(await screen.findByRole('header', { name: 'Toyota Modelo 7 XEI 2021' })).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: 'Mostrar 6' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Mostrar 12 vehículos' }))
  expect(await screen.findByRole('header', { name: 'Toyota Modelo 1 XEI 2021' })).toBeOnTheScreen()
  expect(request).toHaveBeenCalledWith('/api/favoritos?page=1&per_page=12', { token: 'tok' })
  await fireEvent.press(screen.getByRole('button', { name: 'Mostrar 12' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Mostrar 24 vehículos' }))
  expect(await screen.findByRole('header', { name: 'Toyota Modelo 1 XEI 2021' })).toBeOnTheScreen()
  expect(request).toHaveBeenCalledWith('/api/favoritos?page=1&per_page=24', { token: 'tok' })
  await fireEvent.press(screen.getByRole('button', { name: 'Mostrar 24' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Mostrar 6 vehículos' }))
  await fireEvent.press(await screen.findByRole('button', { name: 'Página 2' }))
  await screen.findByRole('header', { name: 'Toyota Modelo 7 XEI 2021' })
  await fireEvent.press(screen.getByRole('button', { name: 'QUITAR' }))
  expect(await screen.findByText('6 vehículos guardados')).toBeOnTheScreen()
  expect(await screen.findByRole('header', { name: 'Toyota Modelo 1 XEI 2021' })).toBeOnTheScreen()
  expect(screen.queryByRole('button', { name: 'Página 2' })).not.toBeOnTheScreen()
})

it('shows local loading instead of the previous visit cards while refreshing', async () => {
  const view = await renderApp('/favoritos')
  await screen.findByText('1 vehículo guardado')
  await fireEvent.press(screen.getByRole('button', { name: 'VER RECOMENDADOS' }))
  request.mockReturnValueOnce(new Promise(() => {}))
  await fireEvent.press(screen.getByRole('button', { name: /^Favoritos,/ }))
  expect(view.getPathname()).toBe('/favoritos')
  expect(screen.getByLabelText('Cargando')).toBeOnTheScreen()
  expect(screen.queryByRole('header', { name: 'Toyota Corolla XEI 2021' })).not.toBeOnTheScreen()
})

it('opens the saved sheet and returns to favorites, preserving the recommendations return flow', async () => {
  jest.mocked(matchingApi).fetchRecommendations.mockResolvedValue(ready([recommendation(7, { is_favorite: true })]))
  const view = await renderApp('/favoritos')
  await fireEvent.press(await screen.findByRole('button', { name: 'VER FICHA' }))
  expect(view.getPathname()).toBe('/vehiculos/7')
  expect(await screen.findByRole('button', { name: 'Quitar Toyota Corolla XEI 2021 de favoritos' })).toBeSelected()
  await fireEvent.press(screen.getByRole('link', { name: 'Volver a favoritos' }))
  expect(view.getPathname()).toBe('/favoritos')
  await screen.findByText('1 vehículo guardado')
  await fireEvent.press(screen.getByRole('button', { name: 'VER RECOMENDADOS' }))
  await fireEvent.press(await screen.findByRole('button', { name: 'VER FICHA' }))
  await fireEvent.press(await screen.findByRole('link', { name: 'Volver a recomendados' }))
  expect(view.getPathname()).toBe('/recomendados')
})

it('returns unavailable saved listings to favorites without redirecting to recommendations', async () => {
  jest.mocked(detailApi).fetchVehicleDetail.mockRejectedValue(new HttpError(404, {}))
  const view = await renderApp('/vehiculos/7?from=favoritos')
  expect(await screen.findByText('Esta publicación ya no está disponible.')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('link', { name: 'Volver a favoritos' }))
  expect(view.getPathname()).toBe('/favoritos')
  expect(await screen.findByText('1 vehículo guardado')).toBeOnTheScreen()
})
