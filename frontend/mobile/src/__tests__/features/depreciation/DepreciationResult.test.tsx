import { render, screen, within } from '@testing-library/react-native'

import DepreciationResult from '../../../features/depreciation/DepreciationResult'
import { depreciation } from '../../../test-utils/depreciation'

function result() {
  const data = depreciation()
  return { projection: data.projection!, reference: data.reference!, kilometers: data.vehicle.kilometraje }
}

it('TC-40: renders the chart and exact resale values in the published currency', async () => {
  await render(<DepreciationResult {...result()} />)
  expect(screen.getByRole('image', { name: 'Proyección del valor publicado a 1, 3 y 5 años' })).toBeOnTheScreen()
  const summary = within(screen.getByLabelText('Valor proyectado'))
  expect(summary.getByText('US$ 20.000')).toBeOnTheScreen()
  expect(summary.getByText('US$ 18.000 · 90%')).toBeOnTheScreen()
  expect(summary.getByText('US$ 14.580 · 72,9%')).toBeOnTheScreen()
  expect(summary.getByText('US$ 11.810 · 59%')).toBeOnTheScreen()
  for (const years of [1, 3, 5]) expect(summary.getByText(`En ${years} ${years === 1 ? 'año' : 'años'}`)).toBeOnTheScreen()
  expect(screen.getByText('10% anual')).toBeOnTheScreen()
  expect(screen.getByText('Años de referencia: 2020, 2021, 2022.')).toBeOnTheScreen()
  expect(screen.getByText('Fecha de referencia: 2026-10-19.')).toBeOnTheScreen()
  expect(screen.getByText('Kilometraje publicado: 62.000 km.')).toBeOnTheScreen()
  expect(screen.getByText(/no un historial de precios/)).toBeOnTheScreen()
  expect(screen.getByText(/sin ajuste por inflación ni tipo de cambio/)).toBeOnTheScreen()
  expect(screen.queryByText(/Promedio del segmento/)).not.toBeOnTheScreen()
})

it('discloses approximate references, stale evidence and unknown mileage', async () => {
  const props = result()
  await render(<DepreciationResult {...props} kilometers={null} reference={{ ...props.reference,
    reference_count: 2, approximate_model: 'Corolla', stale: true }} />)
  expect(screen.getByText('Estimación con 2 referencias compatibles.')).toBeOnTheScreen()
  expect(screen.getByText('Referencia aproximada de un modelo similar: Corolla.')).toBeOnTheScreen()
  expect(screen.getByText('Los valores de referencia pueden estar desactualizados.')).toBeOnTheScreen()
  expect(screen.getByText('Kilometraje no informado.')).toBeOnTheScreen()
})

it('keeps appreciation and zero mileage visible without inventing a loss', async () => {
  const props = result()
  await render(<DepreciationResult {...props} kilometers={0} projection={{ ...props.projection,
    currency: 'ARS', annual_depreciation_percent: -10,
    points: [{ years: 5, value: 22000, retained_percent: 110 }] }} />)
  expect(screen.getByText('-10% anual')).toBeOnTheScreen()
  expect(screen.getByText(/aumento estimado/)).toBeOnTheScreen()
  expect(screen.getByText('$ 22.000 · 110%')).toBeOnTheScreen()
  expect(screen.getByText('Kilometraje publicado: 0 km.')).toBeOnTheScreen()
})
