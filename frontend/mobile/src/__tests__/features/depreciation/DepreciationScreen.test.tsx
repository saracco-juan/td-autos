import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library'
import { router } from 'expo-router'

import * as authApi from '../../../features/auth/api'
import * as api from '../../../features/depreciation/api'
import * as detailApi from '../../../features/vehicle-detail/api'
import { HttpError, NetworkError } from '../../../lib/http'
import * as tokenStorage from '../../../lib/tokenStorage'
import { depreciation } from '../../../test-utils/depreciation'
import { renderApp } from '../../../test-utils/renderApp'
import { vehicle } from '@shared/vehicles/fixtures'
import type { DepreciationResponse } from '@shared/depreciation/types'

jest.mock('../../../features/auth/api')
jest.mock('../../../features/depreciation/api')
jest.mock('../../../features/vehicle-detail/api')
jest.mock('../../../lib/tokenStorage')

const endpoint = '/vehiculos/7/depreciacion'
const service = jest.mocked(api)

beforeEach(() => {
  jest.resetAllMocks()
  jest.mocked(tokenStorage).readToken.mockResolvedValue('tok')
  jest.mocked(authApi).fetchCurrentUser.mockResolvedValue({ id: 1, name: 'Ana', apellido: null,
    email: 'ana@example.com', rol: 'comprador', tiene_diagnostico: true })
  service.fetchDepreciation.mockResolvedValue(depreciation())
  jest.mocked(detailApi).fetchVehicleDetail.mockResolvedValue({ vehicle,
    dealer: { id: 3, nombre: 'Autos Sur', provincia: 'Buenos Aires' } })
})

it('uses the authenticated request for the existing vehicle depreciation endpoint', async () => {
  const actual: typeof api = jest.requireActual('../../../features/depreciation/api')
  const request = jest.fn().mockResolvedValue(depreciation())
  await expect(actual.fetchDepreciation(request, 7)).resolves.toEqual(depreciation())
  expect(request).toHaveBeenCalledWith('/api/vehiculos/7/depreciacion')
})

it('TC-40: opens depreciation from the sheet and returns to that same vehicle', async () => {
  const view = await renderApp('/vehiculos/7')
  await fireEvent.press(await screen.findByRole('button', { name: 'VER DEPRECIACIÓN' }))
  await waitFor(() => expect(view.getPathname()).toBe(endpoint))
  expect(await screen.findByText('DEPRECIACIÓN Y REVENTA')).toBeOnTheScreen()
  expect(screen.getByRole('header', { name: 'Toyota Corolla XEI 2021' })).toBeOnTheScreen()
  expect(screen.getByText('US$ 11.810 · 59%')).toBeOnTheScreen()
  expect(service.fetchDepreciation).toHaveBeenCalledWith(expect.any(Function), 7)
  for (const tab of ['Diagnóstico', 'Recomendados', 'Favoritos', 'Transferencia', 'Perfil']) {
    expect(screen.getByRole('button', { name: new RegExp(`^${tab},`) })).toBeOnTheScreen()
  }
  expect(screen.queryByRole('button', { name: /^depreciacion,/ })).not.toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('link', { name: 'Volver a la ficha' }))
  await waitFor(() => expect(view.getPathname()).toBe('/vehiculos/7'))
  expect(await screen.findByText('FICHA TÉCNICA')).toBeOnTheScreen()
  expect(screen.getByRole('button', { name: 'CALCULAR COSTOS' })).toBeOnTheScreen()
  expect(screen.getByRole('button', { name: 'CHECKLIST DE INSPECCIÓN' })).toBeOnTheScreen()
  expect(screen.getByRole('button', { name: 'COMPARAR' })).toBeOnTheScreen()
})

it.each(['projection', 'reference'] as const)('TC-41: missing %s shows insufficient data without an error or graph', async field => {
  service.fetchDepreciation.mockResolvedValue({ ...depreciation(), [field]: null })
  await renderApp(endpoint)
  expect(await screen.findByText('No hay datos suficientes para estimar la depreciación.')).toBeOnTheScreen()
  expect(screen.getByText(/Necesitamos un precio publicado válido/)).toBeOnTheScreen()
  expect(screen.queryByRole('alert')).not.toBeOnTheScreen()
  expect(screen.queryByLabelText('Valor proyectado')).not.toBeOnTheScreen()
  expect(screen.queryByRole('image')).not.toBeOnTheScreen()
})

it('shows the local loading state until the response is available', async () => {
  service.fetchDepreciation.mockReturnValue(new Promise(() => {}))
  await renderApp(endpoint)
  expect(await screen.findByLabelText('Cargando')).toBeOnTheScreen()
  expect(screen.queryByText('VALOR PROYECTADO')).not.toBeOnTheScreen()
})

it.each([
  ['network', new NetworkError(new Error('offline')), 'Sin conexión con el servidor'],
  ['server', new HttpError(500, {}), 'Algo salió mal'],
])('retries a %s failure and shows the projection', async (_kind, error, title) => {
  service.fetchDepreciation.mockRejectedValueOnce(error).mockResolvedValue(depreciation())
  await renderApp(endpoint)
  expect(await screen.findByText(title)).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: 'REINTENTAR' }))
  expect(await screen.findByText('VALOR PROYECTADO')).toBeOnTheScreen()
  expect(service.fetchDepreciation).toHaveBeenCalledTimes(2)
})

it('does not show stale vehicle data when the listing is gone', async () => {
  service.fetchDepreciation.mockRejectedValue(new HttpError(404, {}))
  await renderApp(endpoint)
  expect(await screen.findByText('Esta publicación ya no está disponible.')).toBeOnTheScreen()
  expect(screen.queryByText('VALOR PROYECTADO')).not.toBeOnTheScreen()
  expect(screen.queryByRole('button', { name: 'REINTENTAR' })).not.toBeOnTheScreen()
})

it('rejects an invalid vehicle id without calling the API and returns to recommendations', async () => {
  const view = await renderApp('/vehiculos/abc/depreciacion')
  expect(await screen.findByText('Esta publicación ya no está disponible.')).toBeOnTheScreen()
  expect(service.fetchDepreciation).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByRole('link', { name: 'Volver a recomendados' }))
  await waitFor(() => expect(view.getPathname()).toBe('/recomendados'))
})

it('ignores a late response after switching to another vehicle', async () => {
  let resolveFirst!: (data: DepreciationResponse) => void
  service.fetchDepreciation.mockReturnValueOnce(new Promise(resolve => { resolveFirst = resolve }))
    .mockResolvedValue({ ...depreciation(), vehicle: { ...depreciation().vehicle, id: 8, modelo: 'Yaris' } })
  await renderApp(endpoint)
  await screen.findByLabelText('Cargando')
  await act(async () => router.replace('/vehiculos/8/depreciacion'))
  expect(await screen.findByRole('header', { name: /Yaris/ })).toBeOnTheScreen()
  await act(async () => resolveFirst(depreciation()))
  expect(screen.getByRole('header', { name: /Yaris/ })).toBeOnTheScreen()
  expect(screen.queryByRole('header', { name: /Corolla/ })).not.toBeOnTheScreen()
})
