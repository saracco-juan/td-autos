import { fireEvent, screen, waitFor } from 'expo-router/testing-library'

import * as authApi from '../../../features/auth/api'
import * as diagnosisApi from '../../../features/diagnosis/api'
import * as dealerApi from '../../../features/recommendations/api'
import * as modelsApi from '../../../features/recommendations/portalModels'
import * as tokenStorage from '../../../lib/tokenStorage'
import { renderApp } from '../../../test-utils/renderApp'
import { portalModel, portalModels } from '../../../test-utils/portalModels'
import { ready, recommendation } from '../../../test-utils/recommendations'

jest.mock('../../../features/auth/api')
jest.mock('../../../features/diagnosis/api')
jest.mock('../../../features/recommendations/api')
jest.mock('../../../features/recommendations/portalModels')
jest.mock('../../../lib/tokenStorage')

const models = jest.mocked(modelsApi)
const button = (name: string) => screen.getByRole('button', { name })
const openPortals = async () => fireEvent.press(screen.getByRole('tab', { name: /^Otros portales/ }))

describe('HU06 mobile portal tab', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    jest.mocked(tokenStorage.readToken).mockResolvedValue('tok')
    jest.mocked(authApi.fetchCurrentUser).mockResolvedValue({
      id: 1, name: 'Ana', apellido: null, email: 'ana@example.com', rol: 'comprador', tiene_diagnostico: true,
    })
    jest.mocked(diagnosisApi.fetchDiagnosis).mockReturnValue(new Promise(() => {}))
    jest.mocked(dealerApi.fetchRecommendations).mockResolvedValue(ready([recommendation(1)]))
    models.fetchPortalModels.mockResolvedValue(portalModels())
  })

  it('TC-18 shows portal models and their dated price source, independently of dealer cards', async () => {
    await renderApp('/recomendados')
    await screen.findByText('Mostrando 1 vehículo')
    expect(models.fetchPortalModels).not.toHaveBeenCalled()
    await openPortals()
    expect(await screen.findByText('1 modelo recomendado')).toBeOnTheScreen()
    expect(screen.getByLabelText('Modelo recomendado: Chevrolet Onix')).toBeOnTheScreen()
    expect(screen.getByText('Precios de referencia: Guía de precios ACARA, 19/10/2026')).toBeOnTheScreen()
    expect(screen.queryByText('COMPARAR (0/2)')).not.toBeOnTheScreen()
    expect(screen.queryByText('Sin filtros aplicados')).not.toBeOnTheScreen()
    await fireEvent.press(button('Sobre estos modelos'))
    expect(screen.getByText(/Estos son modelos, no unidades en venta/)).toBeOnTheScreen()
    await fireEvent.press(button('CERRAR'))
    await fireEvent.press(screen.getByRole('tab', { name: 'Concesionarias' }))
    expect(screen.getByText('Mostrando 1 vehículo')).toBeOnTheScreen()
    expect(screen.getByText('COMPARAR (0/2)')).toBeOnTheScreen()
    expect(dealerApi.fetchRecommendations).toHaveBeenCalledTimes(1)
  })

  it('TC-19 retries models only, and dealer recommendations remain available', async () => {
    models.fetchPortalModels.mockRejectedValueOnce(new Error('Unavailable'))
    await renderApp('/recomendados')
    await screen.findByText('Mostrando 1 vehículo')
    await openPortals()
    expect(await screen.findByText('No pudimos cargar los modelos.')).toBeOnTheScreen()
    await fireEvent.press(button('REINTENTAR'))
    expect(await screen.findByText('Chevrolet Onix')).toBeOnTheScreen()
    expect(models.fetchPortalModels).toHaveBeenCalledTimes(2)
    expect(dealerApi.fetchRecommendations).toHaveBeenCalledTimes(1)
  })

  it('TC-87 shows the empty message and lets the user adjust the diagnosis', async () => {
    models.fetchPortalModels.mockResolvedValue(portalModels([]))
    const view = await renderApp('/recomendados')
    await screen.findByText('Mostrando 1 vehículo')
    await openPortals()
    expect(await screen.findByText('No encontramos modelos para tu diagnóstico.')).toBeOnTheScreen()
    expect(screen.getByText('Probá ajustando el presupuesto o la carrocería.')).toBeOnTheScreen()
    await fireEvent.press(button('AJUSTAR DIAGNÓSTICO'))
    expect(view.getPathname()).toBe('/')
  })

  it('TC-18 renders the nine models in backend order without dealer pagination', async () => {
    models.fetchPortalModels.mockResolvedValue(portalModels(Array.from({ length: 9 }, (_, index) => ({
      ...portalModel, id: index + 1, modelo: `Modelo ${index + 1}`,
    }))))
    await renderApp('/recomendados')
    await screen.findByText('Mostrando 1 vehículo')
    await openPortals()
    expect(await screen.findByText('9 modelos recomendados')).toBeOnTheScreen()
    expect(screen.getAllByLabelText(/^Modelo recomendado:/).map((card) => card.props.accessibilityLabel))
      .toEqual(Array.from({ length: 9 }, (_, index) => `Modelo recomendado: Chevrolet Modelo ${index + 1}`))
    expect(screen.queryByText('COMPARAR (0/2)')).not.toBeOnTheScreen()
  })

  it('asks for an incomplete diagnosis without displaying a model count', async () => {
    models.fetchPortalModels.mockResolvedValue({ status: 'diagnosis_incomplete', modelos: [], fuente_precios: null })
    const view = await renderApp('/recomendados')
    await screen.findByText('Mostrando 1 vehículo')
    await openPortals()
    await fireEvent.press(await screen.findByRole('button', { name: 'IR AL DIAGNÓSTICO' }))
    expect(screen.queryByText('0 modelos recomendados')).not.toBeOnTheScreen()
    expect(view.getPathname()).toBe('/')
  })

  it('keeps a local loading state and discards a response after leaving the portals tab', async () => {
    let resolve!: (value: ReturnType<typeof portalModels>) => void
    models.fetchPortalModels.mockReturnValueOnce(new Promise((done) => { resolve = done }))
    await renderApp('/recomendados')
    await screen.findByText('Mostrando 1 vehículo')
    await openPortals()
    expect(screen.getByLabelText('Cargando')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('tab', { name: 'Concesionarias' }))
    resolve(portalModels([{ ...portalModel, modelo: 'Respuesta vieja' }]))
    await openPortals()
    await waitFor(() => expect(screen.getByText('Chevrolet Onix')).toBeOnTheScreen())
    expect(screen.queryByText('Chevrolet Respuesta vieja')).not.toBeOnTheScreen()
  })
})
