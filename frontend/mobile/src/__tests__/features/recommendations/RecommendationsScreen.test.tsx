import { fireEvent, screen, waitFor, within } from 'expo-router/testing-library'

import * as authApi from '../../../features/auth/api'
import * as diagnosisApi from '../../../features/diagnosis/api'
import * as recommendationsApi from '../../../features/recommendations/api'
import * as vehicleDetailApi from '../../../features/vehicle-detail/api'
import { HttpError, NetworkError } from '../../../lib/http'
import * as tokenStorage from '../../../lib/tokenStorage'
import { renderApp } from '../../../test-utils/renderApp'
import type { RecommendationsResponse } from '@shared/recommendations/matching'
import { ready, recommendation } from '../../../test-utils/recommendations'

jest.mock('../../../features/auth/api')
jest.mock('../../../features/diagnosis/api')
jest.mock('../../../features/recommendations/api')
jest.mock('../../../features/vehicle-detail/api')
jest.mock('../../../lib/tokenStorage')

const auth = jest.mocked(authApi)
const api = jest.mocked(recommendationsApi)
const diagnosis = jest.mocked(diagnosisApi)
const storage = jest.mocked(tokenStorage)

const USER = { id: 1, name: 'Ana', apellido: null, email: 'ana@example.com', rol: 'comprador', tiene_diagnostico: true }
const THREE = [recommendation(1), recommendation(2), recommendation(3)]

const button = (name: string | RegExp) => screen.getByRole('button', { name })
const cards = () => screen.getAllByLabelText(/^Recomendación: /)

async function open(response: RecommendationsResponse | Promise<RecommendationsResponse>) {
  api.fetchRecommendations.mockReturnValue(Promise.resolve(response))
  return renderApp('/recomendados')
}

async function applyFilters(fields: Record<string, string>, transmission?: string) {
  await fireEvent.press(button('Filtros'))
  for (const [label, value] of Object.entries(fields)) {
    await fireEvent.changeText(screen.getByLabelText(label), value)
  }
  if (transmission) await fireEvent.press(screen.getByRole('radio', { name: transmission }))
  await fireEvent.press(button('APLICAR'))
}

describe('RecommendationsScreen', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    storage.readToken.mockResolvedValue('tok')
    auth.fetchCurrentUser.mockResolvedValue(USER)
    diagnosis.fetchDiagnosis.mockReturnValue(new Promise(() => {}))
    jest.mocked(vehicleDetailApi).fetchVehicleDetail.mockReturnValue(new Promise(() => {}))
  })

  it('shows a local loader while the ranking loads', async () => {
    api.fetchRecommendations.mockReturnValue(new Promise(() => {}))
    await renderApp('/recomendados')

    expect(await screen.findByLabelText('Cargando')).toBeOnTheScreen()
    expect(screen.getByText('Mejores opciones para vos')).toBeOnTheScreen()
  })

  it('TC-15 / scenario 1: lists the ranking in backend order, the best match first', async () => {
    await open(ready(THREE))

    expect(await screen.findByText('Mostrando 3 vehículos')).toBeOnTheScreen()
    expect(screen.getByText('AUTOS RECOMENDADOS')).toBeOnTheScreen()
    expect(cards().map((card) => card.props.accessibilityLabel)).toEqual([
      'Recomendación: Toyota Modelo 1 XEI 2016',
      'Recomendación: Toyota Modelo 2 XEI 2017',
      'Recomendación: Toyota Modelo 3 XEI 2018',
    ])
    const first = within(cards()[0])
    expect(first.getByText('MEJOR COINCIDENCIA')).toBeOnTheScreen()
    expect(first.getByText('$ 21.000.000 · 10.000 km · CABA')).toBeOnTheScreen()
    expect(first.getByText('94% de compatibilidad')).toBeOnTheScreen()
    expect(first.getByText('Equivalente: US$ 21.000')).toBeOnTheScreen()
    expect(first.getByText('Autos Sur · Buenos Aires')).toBeOnTheScreen()
    expect(within(cards()[1]).queryByText('MEJOR COINCIDENCIA')).not.toBeOnTheScreen()
    expect(screen.getByText(/^Dólar oficial venta · DolarAPI · \$ 1\.000/)).toBeOnTheScreen()
    // The comparison does not exist on mobile yet; the sheet does.
    expect(screen.queryByText('COMPARAR')).not.toBeOnTheScreen()
    expect(first.getByRole('button', { name: 'VER FICHA' })).toBeOnTheScreen()
    expect(api.fetchRecommendations).toHaveBeenCalledTimes(1)
  })

  it('shows the warnings and, on demand, the score breakdown of a card', async () => {
    await open(ready([recommendation(1, { warnings: ['budget_exceeded'], budget_excess_percent: 3, budget_penalty: 6 })]))

    expect(await screen.findByText('Supera tu presupuesto en 3%.')).toBeOnTheScreen()
    expect(screen.queryByText(/^Uso: 100/)).not.toBeOnTheScreen()
    await fireEvent.press(button('Ver atributos y motivos'))
    expect(screen.getByText('Uso: 100 · Carrocería: 100 · Prioridad: 80 · Confort: 70 (sobre 100).')).toBeOnTheScreen()
    expect(screen.getByText(/^Descuento por presupuesto: 6 puntos/)).toBeOnTheScreen()
  })

  it('warns when there is no quote', async () => {
    await open({ ...ready(THREE), exchange_rate: { quote: null, stale: false, warning: 'exchange_rate_unavailable' } })

    expect(await screen.findByText(/^Sin cotización disponible/)).toBeOnTheScreen()
  })

  it('TC-16 / scenario 2: with no match it says so and suggests adjusting the diagnosis', async () => {
    const view = await open(ready([]))

    expect(await screen.findByText('No encontramos vehículos que coincidan con tu diagnóstico.')).toBeOnTheScreen()
    expect(screen.getByText('Ajustá el diagnóstico para buscar otras opciones.')).toBeOnTheScreen()
    expect(screen.getByText('Mostrando 0 vehículos')).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Filtros' })).not.toBeOnTheScreen()

    await fireEvent.press(button('AJUSTAR DIAGNÓSTICO'))
    await waitFor(() => expect(view.getPathname()).toBe('/'))
  })

  it('TC-75: an incomplete diagnosis explains why there is no ranking and links to the diagnosis', async () => {
    const view = await open({ status: 'diagnosis_incomplete', results: [], exchange_rate: null })

    expect(await screen.findByText('Completá tu diagnóstico para ver recomendaciones.')).toBeOnTheScreen()
    expect(screen.queryByText(/^Mostrando/)).not.toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Filtros' })).not.toBeOnTheScreen()

    await fireEvent.press(button('IR AL DIAGNÓSTICO'))
    await waitFor(() => expect(view.getPathname()).toBe('/'))
  })

  it('explains the deferred resale priority', async () => {
    await open({ status: 'resale_pending', results: [], exchange_rate: null })

    expect(await screen.findByText('Las recomendaciones por reventa todavía no están disponibles.')).toBeOnTheScreen()
  })

  it.each([
    [new NetworkError(new Error('offline')), 'Sin conexión con el servidor'],
    [new HttpError(500, {}), 'Algo salió mal'],
  ])('on a request error (%s) offers REINTENTAR, which loads again', async (error, title) => {
    api.fetchRecommendations.mockRejectedValueOnce(error).mockResolvedValueOnce(ready(THREE))
    await renderApp('/recomendados')

    expect(await screen.findByText(title)).toBeOnTheScreen()
    await fireEvent.press(button('REINTENTAR'))

    expect(await screen.findByText('Mostrando 3 vehículos')).toBeOnTheScreen()
    expect(api.fetchRecommendations).toHaveBeenCalledTimes(2)
  })

  it('TC-17 / scenario 3: coming back to the tab recalculates and shows the new ranking', async () => {
    await open(ready(THREE))
    expect(await screen.findByText('Mostrando 3 vehículos')).toBeOnTheScreen()

    api.fetchRecommendations.mockResolvedValue(ready([recommendation(7)]))
    await fireEvent.press(screen.getByRole('button', { name: /^Favoritos,/ }))
    await fireEvent.press(screen.getByRole('button', { name: /^Recomendados,/ }))

    expect(await screen.findByText('Mostrando 1 vehículo')).toBeOnTheScreen()
    expect(cards().map((card) => card.props.accessibilityLabel)).toEqual(['Recomendación: Toyota Modelo 7 XEI 2022'])
    expect(api.fetchRecommendations).toHaveBeenCalledTimes(2)
  })

  it('pages nine cards at a time and keeps the count', async () => {
    await open(ready(Array.from({ length: 10 }, (_, index) => recommendation(index + 1))))

    expect(await screen.findByText('Mostrando 10 vehículos')).toBeOnTheScreen()
    expect(cards()).toHaveLength(9)
    expect(button('Página anterior')).toBeDisabled()

    await fireEvent.press(button('Página 2'))

    expect(cards().map((card) => card.props.accessibilityLabel)).toEqual(['Recomendación: Toyota Modelo 10 XEI 2025'])
    expect(screen.getByText('Mostrando 10 vehículos')).toBeOnTheScreen()
    expect(button('Página siguiente')).toBeDisabled()
    await fireEvent.press(button('Página anterior'))
    expect(cards()).toHaveLength(9)
  })

  it('hides the pager when everything fits in one page', async () => {
    await open(ready(THREE))

    await screen.findByText('Mostrando 3 vehículos')
    expect(screen.queryByRole('button', { name: 'Página 1' })).not.toBeOnTheScreen()
  })

  it('TC-21: applies the combined filters client-side, keeping the order, and removes them by chip', async () => {
    await open(ready(THREE))
    await screen.findByText('Mostrando 3 vehículos')

    await applyFilters({ 'Precio máximo': '22.500.000', 'Año desde': '2016' }, 'Automática')

    expect(screen.getByText('Mostrando 1 vehículo')).toBeOnTheScreen()
    expect(cards().map((card) => card.props.accessibilityLabel)).toEqual(['Recomendación: Toyota Modelo 1 XEI 2016'])
    expect(button('Quitar Hasta $ 22.500.000')).toBeOnTheScreen()
    expect(button('Quitar Desde 2016')).toBeOnTheScreen()

    await fireEvent.press(button('Quitar Automática'))
    expect(screen.getByText('Mostrando 2 vehículos')).toBeOnTheScreen()
    expect(api.fetchRecommendations).toHaveBeenCalledTimes(1)
  })

  it('opens the filters with the applied values and closes them with the back button', async () => {
    await open(ready(THREE))
    await screen.findByText('Mostrando 3 vehículos')
    await applyFilters({ 'Kilometraje máximo': '20000' })

    await fireEvent.press(button('Filtros'))
    expect(screen.getByLabelText('Kilometraje máximo')).toHaveDisplayValue('20000')
    expect(screen.getByLabelText('Precio máximo')).toHaveDisplayValue('')
    expect(screen.getByRole('radio', { name: 'Cualquiera' })).toBeChecked()

    await fireEvent.changeText(screen.getByLabelText('Kilometraje máximo'), '5')
    await fireEvent.press(button('Volver'))
    expect(screen.queryByText('APLICAR')).not.toBeOnTheScreen()
    expect(screen.getByText('Mostrando 2 vehículos')).toBeOnTheScreen()
  })

  it('rejects a filter that is not a number', async () => {
    await open(ready(THREE))
    await screen.findByText('Mostrando 3 vehículos')

    await applyFilters({ 'Año desde': '20a6' })

    expect(screen.getByText('Ingresá solo números.')).toBeOnTheScreen()
    expect(button('APLICAR')).toBeOnTheScreen()
    expect(screen.getByText('Mostrando 3 vehículos')).toBeOnTheScreen()
  })

  it('TC-22: filters without results show the empty card, and LIMPIAR FILTROS brings the list back', async () => {
    await open(ready(THREE))
    await screen.findByText('Mostrando 3 vehículos')

    await applyFilters({ 'Año desde': '2030' })

    expect(screen.getByText('No encontramos vehículos que cumplan estos filtros.')).toBeOnTheScreen()
    expect(screen.getByText('Quitá o limpiá los filtros para volver a ver tus recomendaciones.')).toBeOnTheScreen()
    expect(screen.getByText('Mostrando 0 vehículos')).toBeOnTheScreen()
    expect(screen.queryByText('Ajustá el diagnóstico para buscar otras opciones.')).not.toBeOnTheScreen()

    await fireEvent.press(screen.getAllByRole('button', { name: 'LIMPIAR FILTROS' })[0])
    expect(screen.getByText('Mostrando 3 vehículos')).toBeOnTheScreen()
  })

  it('S4: VER FICHA opens the sheet of that listing and the back chip returns to the recommendations', async () => {
    const view = await open(ready(THREE))
    await screen.findByText('Mostrando 3 vehículos')

    await fireEvent.press(within(cards()[1]).getByRole('button', { name: 'VER FICHA' }))

    await waitFor(() => expect(view.getPathname()).toBe('/vehiculos/2'))
    await fireEvent.press(await screen.findByRole('link', { name: 'Volver a recomendados' }))
    await waitFor(() => expect(view.getPathname()).toBe('/recomendados'))
  })
})
