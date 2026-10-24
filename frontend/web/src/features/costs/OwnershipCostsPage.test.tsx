import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { apiFetch, HttpError, NetworkError } from '../../lib/http'
import OwnershipCostsPage from './OwnershipCostsPage'
import type { OwnershipCosts } from './types'

vi.mock('../../lib/http', async (original) => ({ ...await original<object>(), apiFetch: vi.fn() }))

const costs = (): OwnershipCosts => ({
  vehicle: { id: 1, make: 'Toyota', model: 'Corolla', version: 'XEI', year: 2022, fuel: 'nafta', province: 'Córdoba',
    published_price: 20000000, published_currency: 'ARS' },
  inputs: { km_per_month: 1500, km_source: 'diagnostico', coverage: 'terceros_completo' },
  purchase: { price: 20000000, transfer: 700000, total: 20700000, budget: { max: 25000000, fits: true, difference: 4300000 } },
  monthly: { fuel: 120000, insurance: 92000, patente: 20000, maintenance: 66000, total: 298000,
    yearly_total: 3576000, not_estimated: [] },
  breakdown: {
    fuel: { km_per_month: 1500, consumption_l_100km: 8, fuel_type: 'nafta', price_fuel_type: 'nafta', unit: 'litro', unit_price: 1000 },
    insurance: { coverage: 'terceros_completo', base: 20000000, body_type: 'sedan', body_label: 'Sedán', base_monthly: 114000,
      value_rate: 0.023, by_value: false, zone_factor: 0.8, province: 'Córdoba', province_known: true, tr_ratio: null,
      terceros_completo: 92000 },
    patente: { base: 20000000, province: 'Córdoba', province_known: true, method: 'bracket_rate', rate: 0.025, bracket_fixed: null,
      bracket_from: null, annual: 500000 },
    maintenance: { fuel_type: 'nafta', body_type: 'sedan', body_label: 'Sedán', km_per_month: 1500, per_km: 38, age_years: 4,
      age_factor: 1.2, fuel_factor: 1 },
    transfer: { base: 20000000, dnrpa_rate: 0.01, stamp_rate: 0.02, province: 'Córdoba', province_known: true, fixed_costs: 100000 },
    rounding: 1000,
  },
  rates_updated_at: '2026-10-23',
  exchange_rate: null,
})

const renderPage = () => render(
  <MemoryRouter initialEntries={['/vehiculos/1/costos']}>
    <Routes><Route path="/vehiculos/:id/costos" element={<OwnershipCostsPage />} /></Routes>
  </MemoryRouter>,
)
const monthly = () => screen.getByRole('region', { name: 'Para mantenerlo' })
const purchase = () => screen.getByRole('region', { name: 'Para comprarlo' })

beforeEach(() => {
  vi.mocked(apiFetch).mockReset().mockResolvedValue(costs())
})

it('shows what it costs to keep and to buy the vehicle without ceiling wording', async () => {
  renderPage()
  expect(await screen.findByRole('heading', { level: 1, name: 'Toyota Corolla XEI 2022' })).toBeInTheDocument()
  expect(apiFetch).toHaveBeenCalledWith('/api/vehiculos/1/costos')
  expect(screen.getByText('COSTO DE POSESIÓN')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Volver a recomendaciones' })).toHaveAttribute('href', '/recomendaciones')

  expect(within(monthly()).getByText('$ 120.000 por mes')).toBeInTheDocument()
  expect(within(monthly()).getByText('$ 92.000 por mes')).toBeInTheDocument()
  expect(within(monthly()).getByText('$ 20.000 por mes')).toBeInTheDocument()
  expect(within(monthly()).getByText('$ 66.000 por mes')).toBeInTheDocument()
  expect(within(monthly()).getByText('Total por mes')).toBeInTheDocument()
  expect(within(monthly()).getByText('$ 298.000')).toBeInTheDocument()
  const yearly = within(monthly()).getByText('Total por año').closest('div') as HTMLElement
  expect(within(yearly).getByText('$ 3.576.000')).toBeInTheDocument()
  expect(within(monthly()).queryByText(/Equivale a/)).not.toBeInTheDocument()

  expect(within(purchase()).getByText('$ 20.000.000')).toBeInTheDocument()
  expect(within(purchase()).getByText('$ 700.000')).toBeInTheDocument()
  expect(within(purchase()).getByText('$ 20.700.000')).toBeInTheDocument()
  expect(screen.getByText('Estimación orientativa con valores actualizados al 23/10/2026, en la provincia de Córdoba. Es un estimativo aproximado.')).toBeInTheDocument()
  expect(screen.getByText('Cuánto te costaría comprarlo y mantenerlo, más allá del precio publicado.')).toBeInTheDocument()
  expect(document.body.textContent).not.toMatch(/hasta|máxim|más alt|salirte/i)
})

it('puts an info button next to each concept and explains it with the numbers of the vehicle', async () => {
  renderPage()
  await screen.findByRole('heading', { level: 1 })
  const tip = async (name: string) => {
    await userEvent.click(screen.getByRole('button', { name: `Cómo calculamos ${name}` }))
    return screen.getByRole('tooltip')
  }
  expect(await tip('Combustible')).toHaveTextContent('1.500 km por mes × 8 L cada 100 km (consumo del auto) × $ 1.000 el litro de nafta = $ 120.000.')
  expect(await tip('Seguro')).toHaveTextContent('Terceros completo para un sedán: $ 114.000 por mes de referencia, × 0,8 por la zona (Córdoba) = $ 92.000 por mes.')
  expect(await tip('Patente')).toHaveTextContent('Patente en Córdoba: 2,5% anual del valor del auto')
  expect(await tip('Mantenimiento')).toHaveTextContent('1.500 km por mes × $ 38 por km para un sedán (service oficial) × 1,2 por antigüedad (4 años)')
  expect(await tip('Transferencia')).toHaveTextContent('Arancel del registro (1%) + sellos de Córdoba (2%)')
  expect(within(monthly()).getAllByRole('button')).toHaveLength(4)
  expect(within(purchase()).getAllByRole('button')).toHaveLength(1)
  expect(screen.queryByRole('button', { name: /Precio publicado/ })).not.toBeInTheDocument()
})

it('explains why the fuel has no estimate', async () => {
  const data = costs()
  vi.mocked(apiFetch).mockResolvedValue({ ...data, monthly: { ...data.monthly, fuel: null, total: 186000, yearly_total: 2232000,
    not_estimated: ['fuel'] }, breakdown: { ...data.breakdown, fuel: null } })
  renderPage()
  await userEvent.click(await screen.findByRole('button', { name: 'Cómo calculamos Combustible' }))
  expect(screen.getByRole('tooltip')).toHaveTextContent('No tenemos datos de consumo de este auto, así que no podemos estimar el combustible.')
})

it('explains the conversion of a USD price with its own info button', async () => {
  const data = costs()
  vi.mocked(apiFetch).mockResolvedValue({ ...data,
    vehicle: { ...data.vehicle, published_price: 20000, published_currency: 'USD' },
    exchange_rate: { sell: 1030, updated_at: '2026-10-20T12:00:00Z' } })
  renderPage()
  await userEvent.click(await screen.findByRole('button', { name: 'Cómo calculamos Precio publicado' }))
  expect(screen.getByRole('tooltip')).toHaveTextContent('Precio publicado en US$ 20.000, convertido al dólar oficial venta de $ 1.030.')
})

it('prefills the form from the diagnosis without a hint under the km', async () => {
  renderPage()
  expect(await screen.findByLabelText('Kilómetros por mes')).toHaveValue(1500)
  expect(screen.getByLabelText('Cobertura del seguro')).toHaveValue('terceros_completo')
  expect(screen.queryByText(/diagnóstico/)).not.toBeInTheDocument()
})

it('explains an estimated default km value', async () => {
  vi.mocked(apiFetch).mockResolvedValue({ ...costs(), inputs: { ...costs().inputs, km_source: 'default' } })
  renderPage()
  expect(await screen.findByText('Usamos un valor estimado.')).toBeInTheDocument()
})

it('tells the user the purchase fits the budget and by how much', async () => {
  renderPage()
  expect(await screen.findByText('Entra en tu presupuesto (te sobran $ 4.300.000).')).toBeInTheDocument()
})

it('tells the user the purchase exceeds the budget', async () => {
  const data = costs()
  vi.mocked(apiFetch).mockResolvedValue({ ...data, purchase: { ...data.purchase,
    budget: { max: 20000000, fits: false, difference: -700000 } } })
  renderPage()
  expect(await screen.findByText('Supera tu presupuesto por $ 700.000.')).toBeInTheDocument()
  expect(screen.queryByText(/Entra en tu presupuesto/)).not.toBeInTheDocument()
})

it('hides the budget message when there is no cap', async () => {
  const data = costs()
  vi.mocked(apiFetch).mockResolvedValue({ ...data, purchase: { ...data.purchase, budget: null } })
  renderPage()
  await screen.findByText('$ 20.700.000')
  expect(screen.queryByText(/presupuesto/)).not.toBeInTheDocument()
})

it('says the fuel cannot be estimated and that the total leaves it out', async () => {
  const data = costs()
  vi.mocked(apiFetch).mockResolvedValue({ ...data, monthly: { ...data.monthly, fuel: null,
    total: 186000, yearly_total: 2232000, not_estimated: ['fuel'] } })
  renderPage()
  expect(await screen.findByText('No podemos estimarlo')).toBeInTheDocument()
  expect(within(monthly()).getByText('$ 186.000')).toBeInTheDocument()
  expect(screen.getByText('El total no incluye el combustible.')).toBeInTheDocument()
})

it('shows charging costs as coming soon for an electric car', async () => {
  const data = costs()
  vi.mocked(apiFetch).mockResolvedValue({ ...data, vehicle: { ...data.vehicle, fuel: 'electrico' },
    monthly: { ...data.monthly, fuel: null, total: 186000, yearly_total: 2232000, not_estimated: ['fuel'] },
    breakdown: { ...data.breakdown, fuel: null } })
  renderPage()
  expect(await screen.findByText('Próximamente')).toBeInTheDocument()
  expect(screen.queryByText('No podemos estimarlo')).not.toBeInTheDocument()
  expect(screen.getByText('El total no incluye la carga del auto.')).toBeInTheDocument()
  expect(screen.queryByText('El total no incluye el combustible.')).not.toBeInTheDocument()
  expect(within(monthly()).getByText('$ 186.000')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Cómo calculamos Combustible' }))
  expect(screen.getByRole('tooltip')).toHaveTextContent('Pronto vas a poder ver cuánto te cuesta cargarlo.')
})

it('keeps "No podemos estimarlo" for a non-electric car without a fuel type', async () => {
  const data = costs()
  vi.mocked(apiFetch).mockResolvedValue({ ...data, vehicle: { ...data.vehicle, fuel: null },
    monthly: { ...data.monthly, fuel: null, not_estimated: ['fuel'] }, breakdown: { ...data.breakdown, fuel: null } })
  renderPage()
  expect(await screen.findByText('No podemos estimarlo')).toBeInTheDocument()
  expect(screen.queryByText('Próximamente')).not.toBeInTheDocument()
  expect(screen.getByText('El total no incluye el combustible.')).toBeInTheDocument()
})

it('shows the ARS conversion and the rate for a USD price', async () => {
  const data = costs()
  vi.mocked(apiFetch).mockResolvedValue({ ...data,
    vehicle: { ...data.vehicle, published_price: 20000, published_currency: 'USD' },
    purchase: { ...data.purchase, price: 20600000 },
    exchange_rate: { sell: 1030, updated_at: '2026-10-20T12:00:00Z' } })
  renderPage()
  expect(await screen.findByText('$ 20.600.000')).toBeInTheDocument()
  expect(screen.getByText('Publicado en US$ 20.000, al dólar oficial venta de $ 1.030 (20/10/2026).')).toBeInTheDocument()
})

it('recalculates with the km and the coverage the user chose, loading only the results', async () => {
  renderPage()
  const km = await screen.findByLabelText('Kilómetros por mes')
  await userEvent.clear(km)
  await userEvent.type(km, '2500')
  await userEvent.selectOptions(screen.getByLabelText('Cobertura del seguro'), 'todo_riesgo')
  let resolve: (value: OwnershipCosts) => void = () => {}
  vi.mocked(apiFetch).mockReturnValueOnce(new Promise((done) => { resolve = done }))
  await userEvent.click(screen.getByRole('button', { name: 'RECALCULAR' }))
  expect(apiFetch).toHaveBeenLastCalledWith('/api/vehiculos/1/costos?km=2500&cobertura=todo_riesgo')
  expect(screen.getByRole('status')).toHaveTextContent('Cargando')
  expect(screen.getByLabelText('Kilómetros por mes')).toBeVisible()
  expect(screen.queryByRole('region', { name: 'Para mantenerlo' })).not.toBeInTheDocument()
  const data = costs()
  resolve({ ...data, inputs: { km_per_month: 2500, km_source: 'usuario', coverage: 'todo_riesgo' },
    monthly: { ...data.monthly, total: 400000 } })
  expect(await within(await screen.findByRole('region', { name: 'Para mantenerlo' })).findByText('$ 400.000')).toBeInTheDocument()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

it.each([['-5'], ['abc'], ['1.5'], ['20001']])('rejects %s before calling the API', async (value) => {
  renderPage()
  const km = await screen.findByLabelText('Kilómetros por mes')
  await userEvent.clear(km)
  await userEvent.type(km, value)
  await userEvent.click(screen.getByRole('button', { name: 'RECALCULAR' }))
  expect(await screen.findByText(/Revisá los kilómetros/)).toBeInTheDocument()
  expect(apiFetch).toHaveBeenCalledTimes(1)
})

it('uses the same messages as the backend for negative and too-large values', async () => {
  renderPage()
  const km = await screen.findByLabelText('Kilómetros por mes')
  await userEvent.clear(km)
  await userEvent.type(km, '-5')
  await userEvent.click(screen.getByRole('button', { name: 'RECALCULAR' }))
  expect(screen.getByText('Revisá los kilómetros: tienen que ser un número entero mayor o igual a 0.')).toBeInTheDocument()
  await userEvent.clear(km)
  await userEvent.type(km, '20001')
  await userEvent.click(screen.getByRole('button', { name: 'RECALCULAR' }))
  expect(screen.getByText('Revisá los kilómetros: el máximo es 20.000 por mes.')).toBeInTheDocument()
})

it('shows the server validation messages under each field and keeps the previous result', async () => {
  renderPage()
  await screen.findByLabelText('Kilómetros por mes')
  vi.mocked(apiFetch).mockRejectedValueOnce(new HttpError(422, { errors: {
    km: ['Revisá los kilómetros: el máximo es 20.000 por mes.'], cobertura: ['Elegí una cobertura de la lista.'] } }))
  await userEvent.click(screen.getByRole('button', { name: 'RECALCULAR' }))
  expect(await screen.findByText('Revisá los kilómetros: el máximo es 20.000 por mes.')).toBeInTheDocument()
  expect(screen.getByText('Elegí una cobertura de la lista.')).toBeInTheDocument()
  expect(within(monthly()).getByText('$ 298.000')).toBeInTheDocument()
})

it('says the vehicle was not found', async () => {
  vi.mocked(apiFetch).mockRejectedValue(new HttpError(404, { message: 'No encontramos ese vehículo.' }))
  renderPage()
  expect(await screen.findByText('No encontramos ese vehículo.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Volver a recomendaciones' })).toBeInTheDocument()
  expect(screen.queryByLabelText('Kilómetros por mes')).not.toBeInTheDocument()
})

it('shows the backend message when the dollar rate is unavailable', async () => {
  const message = 'No pudimos obtener la cotización del dólar. Probá de nuevo en unos minutos.'
  vi.mocked(apiFetch).mockRejectedValue(new HttpError(503, { message }))
  renderPage()
  expect(await screen.findByText(message)).toBeInTheDocument()
})

it.each([new NetworkError(new Error()), new HttpError(500, null)])('shows a generic message on failure', async (error) => {
  vi.mocked(apiFetch).mockRejectedValue(error)
  renderPage()
  expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos calcular los costos. Intentá de nuevo en unos minutos.')
})
