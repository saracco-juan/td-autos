import { fireEvent, screen, waitFor, within } from 'expo-router/testing-library'

import * as authApi from '../../../features/auth/api'
import * as costsApi from '../../../features/costs/api'
import { HttpError, NetworkError } from '../../../lib/http'
import * as tokenStorage from '../../../lib/tokenStorage'
import { costs } from '../../../test-utils/costs'
import { renderApp } from '../../../test-utils/renderApp'
import type { OwnershipCosts } from '@shared/costs/types'

jest.mock('../../../features/auth/api')
jest.mock('../../../features/costs/api')
jest.mock('../../../lib/tokenStorage')

const auth = jest.mocked(authApi)
const api = jest.mocked(costsApi)
const storage = jest.mocked(tokenStorage)

const USER = { id: 1, name: 'Ana', apellido: null, email: 'ana@example.com', rol: 'comprador', tiene_diagnostico: true }
const URL = '/vehiculos/7/costos'
const KM_MIN = 'Revisá los kilómetros: tienen que ser un número entero mayor o igual a 0.'
const KM_MAX = 'Revisá los kilómetros: el máximo es 20.000 por mes.'

const monthly = () => within(screen.getByTestId('costs-monthly'))
const purchase = () => within(screen.getByTestId('costs-purchase'))
const withoutFuel = (data: OwnershipCosts, fuel: OwnershipCosts['vehicle']['fuel'] = data.vehicle.fuel): OwnershipCosts => ({
  ...data,
  vehicle: { ...data.vehicle, fuel },
  monthly: { ...data.monthly, fuel: null, total: 112000, not_estimated: ['fuel'] },
  yearly: { service: 972000, total: 2316000 },
  breakdown: { ...data.breakdown, fuel: null },
})

describe('CostsScreen', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    storage.readToken.mockResolvedValue('tok')
    auth.fetchCurrentUser.mockResolvedValue(USER)
    api.fetchCosts.mockResolvedValue(costs())
  })

  it('S1 / S3: opens already computed and shows what it takes to keep and to buy the vehicle', async () => {
    const view = await renderApp(URL)

    expect(await screen.findByRole('header', { name: 'Toyota Corolla XEI 2022' })).toBeOnTheScreen()
    expect(view.getPathname()).toBe(URL)
    expect(api.fetchCosts).toHaveBeenCalledWith(expect.any(Function), 7)
    expect(screen.getByText('COSTO DE POSESIÓN')).toBeOnTheScreen()
    expect(screen.getByText('Cuánto te costaría comprarlo y mantenerlo, más allá del precio publicado.')).toBeOnTheScreen()

    expect(monthly().getByText('PARA MANTENERLO')).toBeOnTheScreen()
    expect(monthly().getByText('$ 120.000 por mes')).toBeOnTheScreen()
    expect(monthly().getByText('$ 96.000 por mes')).toBeOnTheScreen()
    expect(monthly().getByText('$ 20.000 por mes')).toBeOnTheScreen()
    expect(monthly().getByText('Total por mes')).toBeOnTheScreen()
    expect(monthly().getByText('$ 236.000')).toBeOnTheScreen()
    expect(monthly().getByText('Service (por año)')).toBeOnTheScreen()
    expect(monthly().getByText('$ 972.000')).toBeOnTheScreen()
    expect(monthly().getByText('Total por año')).toBeOnTheScreen()
    expect(monthly().getByText('$ 3.804.000')).toBeOnTheScreen()

    expect(purchase().getByText('PARA COMPRARLO')).toBeOnTheScreen()
    expect(purchase().getByText('$ 20.700.000')).toBeOnTheScreen()
    expect(purchase().getByText('Precio más transferencia')).toBeOnTheScreen()
    expect(purchase().getByText('Precio publicado')).toBeOnTheScreen()
    expect(purchase().getByText('$ 20.000.000')).toBeOnTheScreen()
    expect(purchase().getByText('$ 700.000')).toBeOnTheScreen()
    expect(
      screen.getByText('Estimación orientativa con valores actualizados al 23/10/2026, en la provincia de Córdoba. Es un estimativo aproximado.'),
    ).toBeOnTheScreen()
    expect(screen.queryByText(/hasta|máxim|más alt|salirte|redonde|techo/i)).not.toBeOnTheScreen()
  })

  it('prefills the form from the diagnosis, without a hint under the km', async () => {
    await renderApp(URL)

    expect(await screen.findByLabelText('Kilómetros por mes')).toHaveDisplayValue('1500')
    expect(screen.getByRole('radio', { name: 'Terceros completo' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Todo riesgo' })).not.toBeChecked()
    expect(screen.queryByText('Usamos un valor estimado.')).not.toBeOnTheScreen()
  })

  it('explains an estimated default km value', async () => {
    api.fetchCosts.mockResolvedValue({ ...costs(), inputs: { ...costs().inputs, km_source: 'default' } })
    await renderApp(URL)

    expect(await screen.findByText('Usamos un valor estimado.')).toBeOnTheScreen()
  })

  it('S4: opens each explanation on tap with this vehicle numbers and closes it on a second tap', async () => {
    await renderApp(URL)
    await screen.findByText('PARA MANTENERLO')

    const fuel = screen.getByRole('button', { name: 'Cómo calculamos Combustible' })
    expect(fuel).toBeCollapsed()
    expect(screen.queryByText(/L cada 100 km/)).not.toBeOnTheScreen()

    await fireEvent.press(fuel)
    expect(
      screen.getByText('1.500 km por mes × 8 L cada 100 km (consumo del auto) × $ 1.000 el litro de nafta = $ 120.000.'),
    ).toBeOnTheScreen()
    expect(fuel).toBeExpanded()

    await fireEvent.press(fuel)
    expect(screen.queryByText(/L cada 100 km/)).not.toBeOnTheScreen()
  })

  it('S4: explains insurance, patente, service and transfer', async () => {
    await renderApp(URL)
    await screen.findByText('PARA MANTENERLO')

    const open = (name: string) => fireEvent.press(screen.getByRole('button', { name: `Cómo calculamos ${name}` }))
    await open('Seguro')
    expect(
      screen.getByText('Terceros completo: ($ 46.000 + 0,37% mensual del valor del auto, $ 74.000) × 0,8 por la zona (Córdoba) = $ 96.000 por mes.'),
    ).toBeOnTheScreen()
    await open('Patente')
    expect(screen.getByText(/Patente en Córdoba: 2,5% anual del valor del auto/)).toBeOnTheScreen()
    await open('Service')
    expect(
      screen.getByText('18.000 km al año ÷ 10.000 km = 2 services × $ 486.000 (service oficial Toyota Corolla XEI) = $ 972.000 al año.'),
    ).toBeOnTheScreen()
    await open('Transferencia')
    expect(screen.getByText(/Arancel del registro \(1%\) \+ sellos de Córdoba \(2%\)/)).toBeOnTheScreen()

    expect(monthly().getAllByRole('button')).toHaveLength(4)
    expect(purchase().getAllByRole('button')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: /Precio publicado/ })).not.toBeOnTheScreen()
  })

  it('S4: explains why the fuel has no estimate', async () => {
    api.fetchCosts.mockResolvedValue(withoutFuel(costs()))
    await renderApp(URL)

    await fireEvent.press(await screen.findByRole('button', { name: 'Cómo calculamos Combustible' }))

    expect(
      screen.getByText('No tenemos datos de consumo de este auto, así que no podemos estimar el combustible.'),
    ).toBeOnTheScreen()
  })

  it('S4: says the fuel cannot be estimated and that the total leaves it out', async () => {
    api.fetchCosts.mockResolvedValue(withoutFuel(costs(), null))
    await renderApp(URL)

    expect(await screen.findByText('No podemos estimarlo')).toBeOnTheScreen()
    expect(screen.queryByText('Próximamente')).not.toBeOnTheScreen()
    expect(screen.getByText('El total no incluye el combustible.')).toBeOnTheScreen()
    expect(monthly().getByText('$ 112.000')).toBeOnTheScreen()
    expect(monthly().getByText('$ 972.000')).toBeOnTheScreen()
  })

  it('S4: shows charging costs as coming soon for an electric car', async () => {
    api.fetchCosts.mockResolvedValue(withoutFuel(costs(), 'electrico'))
    await renderApp(URL)

    expect(await screen.findByText('Próximamente')).toBeOnTheScreen()
    expect(screen.queryByText('No podemos estimarlo')).not.toBeOnTheScreen()
    expect(screen.getByText('El total no incluye la carga del auto.')).toBeOnTheScreen()
    expect(screen.queryByText('El total no incluye el combustible.')).not.toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Cómo calculamos Combustible' }))
    expect(screen.getByText('Pronto vas a poder ver cuánto te cuesta cargarlo.')).toBeOnTheScreen()
  })

  it('S4: shows the ARS conversion, the rate note and the USD explanation for a USD price', async () => {
    const data = costs()
    api.fetchCosts.mockResolvedValue({
      ...data,
      vehicle: { ...data.vehicle, published_price: 20000, published_currency: 'USD' },
      purchase: { ...data.purchase, price: 20600000 },
      exchange_rate: { sell: 1030, updated_at: '2026-10-20T12:00:00Z' },
    })
    await renderApp(URL)

    expect(await screen.findByText('$ 20.600.000')).toBeOnTheScreen()
    expect(screen.getByText('Publicado en US$ 20.000, al dólar oficial venta de $ 1.030 (20/10/2026).')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Cómo calculamos Precio publicado' }))
    expect(screen.getByText('Precio publicado en US$ 20.000, convertido al dólar oficial venta de $ 1.030.')).toBeOnTheScreen()
  })

  it('does not show the USD note for a price in pesos', async () => {
    await renderApp(URL)
    await screen.findByText('PARA COMPRARLO')

    expect(screen.queryByText(/Publicado en US\$/)).not.toBeOnTheScreen()
  })

  it('tells the user the purchase fits the budget and by how much', async () => {
    await renderApp(URL)

    expect(await screen.findByText('Entra en tu presupuesto (te sobran $ 4.300.000).')).toBeOnTheScreen()
  })

  it('tells the user the purchase exceeds the budget', async () => {
    const data = costs()
    api.fetchCosts.mockResolvedValue({ ...data, purchase: { ...data.purchase, budget: { max: 20000000, fits: false, difference: -700000 } } })
    await renderApp(URL)

    expect(await screen.findByText('Supera tu presupuesto por $ 700.000.')).toBeOnTheScreen()
    expect(screen.queryByText(/Entra en tu presupuesto/)).not.toBeOnTheScreen()
  })

  it('hides the budget message when there is no budget', async () => {
    const data = costs()
    api.fetchCosts.mockResolvedValue({ ...data, purchase: { ...data.purchase, budget: null } })
    await renderApp(URL)

    await screen.findByText('$ 20.700.000')
    expect(screen.queryByText(/presupuesto/)).not.toBeOnTheScreen()
  })

  it('S3: recalculates with the km and the coverage the user chose, loading only the results', async () => {
    await renderApp(URL)
    const km = await screen.findByLabelText('Kilómetros por mes')
    await fireEvent.changeText(km, '2500')
    await fireEvent.press(screen.getByRole('radio', { name: 'Todo riesgo' }))
    let resolve: (value: OwnershipCosts) => void = () => {}
    api.fetchCosts.mockReturnValueOnce(new Promise((done) => (resolve = done)))

    await fireEvent.press(screen.getByRole('button', { name: 'RECALCULAR' }))

    expect(api.fetchCosts).toHaveBeenLastCalledWith(expect.any(Function), 7, { km: 2500, coverage: 'todo_riesgo' })
    expect(screen.getByLabelText('Cargando')).toBeOnTheScreen()
    expect(screen.getByLabelText('Kilómetros por mes')).toBeOnTheScreen()
    expect(screen.queryByText('PARA MANTENERLO')).not.toBeOnTheScreen()
    const data = costs()
    resolve({ ...data, inputs: { km_per_month: 2500, km_source: 'usuario', coverage: 'todo_riesgo' }, monthly: { ...data.monthly, total: 400000 } })
    expect(await within(await screen.findByTestId('costs-monthly')).findByText('$ 400.000')).toBeOnTheScreen()
    expect(screen.queryByLabelText('Cargando')).not.toBeOnTheScreen()
  })

  it.each([
    ['-5', KM_MIN],
    ['abc', KM_MIN],
    ['1.5', KM_MIN],
    ['20001', KM_MAX],
  ])('S2: rejects km "%s" under the field, without calling the API and keeping the result', async (value, message) => {
    await renderApp(URL)
    await fireEvent.changeText(await screen.findByLabelText('Kilómetros por mes'), value)

    await fireEvent.press(screen.getByRole('button', { name: 'RECALCULAR' }))

    expect(screen.getByText(message)).toBeOnTheScreen()
    expect(api.fetchCosts).toHaveBeenCalledTimes(1)
    expect(monthly().getByText('$ 236.000')).toBeOnTheScreen()
  })

  it('shows the server validation messages under the fields and keeps the previous result', async () => {
    await renderApp(URL)
    await screen.findByLabelText('Kilómetros por mes')
    api.fetchCosts.mockRejectedValueOnce(
      new HttpError(422, { errors: { km: [KM_MAX], cobertura: ['Elegí una cobertura de la lista.'] } }),
    )

    await fireEvent.press(screen.getByRole('button', { name: 'RECALCULAR' }))

    expect(await screen.findByText(KM_MAX)).toBeOnTheScreen()
    expect(screen.getByText('Elegí una cobertura de la lista.')).toBeOnTheScreen()
    expect(monthly().getByText('$ 236.000')).toBeOnTheScreen()
  })

  it('keeps the previous result and shows a message when a recalculation fails', async () => {
    await renderApp(URL)
    await screen.findByLabelText('Kilómetros por mes')
    api.fetchCosts.mockRejectedValueOnce(new NetworkError(new Error('offline')))

    await fireEvent.press(screen.getByRole('button', { name: 'RECALCULAR' }))

    expect(await screen.findByText('No pudimos calcular los costos. Intentá de nuevo en unos minutos.')).toBeOnTheScreen()
    expect(monthly().getByText('$ 236.000')).toBeOnTheScreen()
    expect(screen.queryByLabelText('Cargando')).not.toBeOnTheScreen()
  })

  it('S5: says the vehicle was not found on 404', async () => {
    api.fetchCosts.mockRejectedValue(new HttpError(404, { message: 'No encontramos ese vehículo.' }))
    await renderApp(URL)

    expect(await screen.findByText('No encontramos ese vehículo.')).toBeOnTheScreen()
    expect(screen.queryByLabelText('Kilómetros por mes')).not.toBeOnTheScreen()
  })

  it('S5: treats an id that cannot be one as not found without calling the API', async () => {
    await renderApp('/vehiculos/abc/costos')

    expect(await screen.findByText('No encontramos ese vehículo.')).toBeOnTheScreen()
    expect(api.fetchCosts).not.toHaveBeenCalled()
  })

  it.each([
    ['network', new NetworkError(new Error('offline')), 'Sin conexión con el servidor'],
    ['503', new HttpError(503, { message: 'No pudimos obtener la cotización del dólar.' }), 'Algo salió mal'],
    ['500', new HttpError(500, null), 'Algo salió mal'],
  ])('S5: %s failure offers a retry that loads the screen', async (_kind, error, title) => {
    api.fetchCosts.mockRejectedValueOnce(error).mockResolvedValue(costs())
    await renderApp(URL)

    expect(await screen.findByText(title)).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'REINTENTAR' }))

    expect(await screen.findByText('PARA MANTENERLO')).toBeOnTheScreen()
    expect(api.fetchCosts).toHaveBeenCalledTimes(2)
  })

  it('shows a local loader while the first calculation loads', async () => {
    api.fetchCosts.mockReturnValue(new Promise(() => {}))
    await renderApp(URL)

    expect(await screen.findByLabelText('Cargando')).toBeOnTheScreen()
    await waitFor(() => expect(screen.queryByText('PARA MANTENERLO')).not.toBeOnTheScreen())
  })
})
