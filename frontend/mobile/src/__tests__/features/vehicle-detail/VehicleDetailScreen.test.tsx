import { fireEvent, screen, waitFor } from 'expo-router/testing-library'

import * as authApi from '../../../features/auth/api'
import * as detailApi from '../../../features/vehicle-detail/api'
import type { VehicleDetailResponse } from '../../../features/vehicle-detail/types'
import { vehicle } from '@shared/vehicles/fixtures'
import { HttpError, NetworkError } from '../../../lib/http'
import * as tokenStorage from '../../../lib/tokenStorage'
import { renderApp } from '../../../test-utils/renderApp'

jest.mock('../../../features/auth/api')
jest.mock('../../../features/vehicle-detail/api')
jest.mock('../../../lib/tokenStorage')

const auth = jest.mocked(authApi)
const api = jest.mocked(detailApi)
const storage = jest.mocked(tokenStorage)

const USER = { id: 1, name: 'Ana', apellido: null, email: 'ana@example.com', rol: 'comprador', tiene_diagnostico: true }
const URL = '/vehiculos/7'
const DEALER = { id: 3, nombre: 'Autos Sur', provincia: 'Buenos Aires' }
const response = (overrides: Partial<VehicleDetailResponse['vehicle']> = {}): VehicleDetailResponse => ({
  vehicle: { ...vehicle, ...overrides },
  dealer: DEALER,
})

describe('VehicleDetailScreen', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    storage.readToken.mockResolvedValue('tok')
    auth.fetchCurrentUser.mockResolvedValue(USER)
  })

  it('S1 / TC-26: shows the complete sheet from its deep link, bottom bar included', async () => {
    api.fetchVehicleDetail.mockResolvedValue(response({ frenos_abs: true }))
    const view = await renderApp(URL)

    expect(await screen.findByText('FICHA TÉCNICA')).toBeOnTheScreen()
    expect(view.getPathname()).toBe(URL)
    expect(api.fetchVehicleDetail).toHaveBeenCalledWith(expect.any(Function), 7)
    expect(screen.getByRole('header', { name: 'Toyota Corolla XEI 2021' })).toBeOnTheScreen()
    expect(screen.getByText('Automática · Nafta · 62.000 km · CABA')).toBeOnTheScreen()
    expect(screen.getByText('$ 28.900.000')).toBeOnTheScreen()
    expect(screen.getByText('Concesionaria verificada · Autos Sur')).toBeOnTheScreen()
    expect(screen.getByTestId('gallery-cover')).toBeOnTheScreen()
    expect(screen.getByRole('link', { name: 'Volver a recomendados' })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'CHECKLIST DE INSPECCIÓN' })).toBeOnTheScreen()
    expect(screen.getByRole('tab', { name: 'Información general' })).toBeSelected()
    expect(screen.getByText('Único dueño')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: /^Diagnóstico,/ })).toBeOnTheScreen()
    for (const retired of ['VER PUBLICACIÓN', 'CALCULAR COSTOS', 'COMPARAR']) {
      expect(screen.queryByRole('button', { name: retired })).not.toBeOnTheScreen()
    }
  })

  it('shows a local loader while the sheet loads', async () => {
    api.fetchVehicleDetail.mockReturnValue(new Promise(() => {}))
    await renderApp(URL)

    expect(await screen.findByLabelText('Cargando')).toBeOnTheScreen()
  })

  it('S2 / TC-27: renders an incomplete publication with "No disponible" and no error', async () => {
    api.fetchVehicleDetail.mockResolvedValue(
      response({
        precio: null,
        moneda: null,
        kilometraje: null,
        ubicacion: null,
        transmision: null,
        combustible: null,
        descripcion: null,
        fotos: [],
      }),
    )
    await renderApp(URL)

    expect(await screen.findByText('FICHA TÉCNICA')).toBeOnTheScreen()
    expect(screen.getByText('Precio no disponible.')).toBeOnTheScreen()
    expect(screen.getByText('Fotos no disponibles.')).toBeOnTheScreen()
    expect(screen.getByText('Descripción no disponible.')).toBeOnTheScreen()
    expect(screen.getAllByText('No disponible').length).toBeGreaterThan(0)
    expect(screen.queryByRole('alert')).not.toBeOnTheScreen()
  })

  it('S3: says the publication is gone on 404 and points back to the recommendations', async () => {
    api.fetchVehicleDetail.mockRejectedValue(new HttpError(404, {}))
    await renderApp(URL)

    expect(await screen.findByText('Esta publicación ya no está disponible.')).toBeOnTheScreen()
    expect(screen.getByText('Volvé a tus recomendaciones para elegir otro vehículo.')).toBeOnTheScreen()
    expect(screen.getByRole('link', { name: 'Volver a recomendados' })).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'CHECKLIST DE INSPECCIÓN' })).not.toBeOnTheScreen()
  })

  it('S3: treats an id that cannot be one as unavailable without calling the API', async () => {
    await renderApp('/vehiculos/abc')

    expect(await screen.findByText('Esta publicación ya no está disponible.')).toBeOnTheScreen()
    expect(api.fetchVehicleDetail).not.toHaveBeenCalled()
  })

  it.each([
    ['network', new NetworkError(new Error('offline')), 'Sin conexión con el servidor'],
    ['server', new HttpError(500, {}), 'Algo salió mal'],
  ])('S3: %s failure offers a retry that loads the sheet', async (_kind, error, title) => {
    api.fetchVehicleDetail.mockRejectedValueOnce(error).mockResolvedValue(response())
    await renderApp(URL)

    expect(await screen.findByText(title)).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'REINTENTAR' }))

    expect(await screen.findByText('FICHA TÉCNICA')).toBeOnTheScreen()
    expect(api.fetchVehicleDetail).toHaveBeenCalledTimes(2)
  })

  it('switches the specification section from the tabs', async () => {
    api.fetchVehicleDetail.mockResolvedValue(response())
    await renderApp(URL)
    await screen.findByText('FICHA TÉCNICA')

    await fireEvent.press(screen.getByRole('tab', { name: 'Motor y consumo' }))

    expect(screen.getByText('170 CV')).toBeOnTheScreen()
    expect(screen.queryByText('Kilometraje')).not.toBeOnTheScreen()
  })

  it('falls back to a text message when the cover photo is broken', async () => {
    api.fetchVehicleDetail.mockResolvedValue(response())
    await renderApp(URL)

    await fireEvent(await screen.findByTestId('gallery-cover'), 'error')

    expect(screen.getByText('Esta foto no está disponible.')).toBeOnTheScreen()
  })

  it('S4: opens the inspection checklist from the sheet', async () => {
    api.fetchVehicleDetail.mockResolvedValue(response())
    const view = await renderApp(URL)

    await fireEvent.press(await screen.findByRole('button', { name: 'CHECKLIST DE INSPECCIÓN' }))

    await waitFor(() => expect(view.getPathname()).toBe('/vehiculos/7/inspeccion'))
  })
})
