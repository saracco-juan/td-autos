import { render, screen, within } from '@testing-library/react'
import { expect, it } from 'vitest'
import DepreciationResult from './DepreciationResult'

const projection = { current_value: 20000, currency: 'USD' as const, annual_depreciation_percent: 10,
  points: [{ years: 1, value: 18000, retained_percent: 90 },
    { years: 3, value: 14580, retained_percent: 72.9 }, { years: 5, value: 11809.8, retained_percent: 59.049 }] }
const reference = { source_date: '2026-10-19', years_used: [2020, 2021, 2022],
  reference_count: 1, approximate_model: null, stale: false }

it('TC-40 shows the published currency, annual estimate, chart and all resale horizons', () => {
  render(<DepreciationResult projection={projection} reference={reference} kilometers={62000} />)
  expect(screen.getByRole('img', { name: 'Proyección del valor publicado a 1, 3 y 5 años' })).toBeInTheDocument()
  const summary = screen.getByRole('table', { name: 'Valor proyectado' })
  expect(within(summary).getByText('Valor actual')).toBeInTheDocument()
  for (const years of [1, 3, 5]) expect(within(summary).getByText(`En ${years} ${years === 1 ? 'año' : 'años'}`)).toBeInTheDocument()
  expect(within(summary).getByText('US$ 20.000')).toBeInTheDocument()
  expect(within(summary).getByText(/US\$ 11.810/)).toBeInTheDocument()
  expect(screen.getByText('10% anual')).toBeInTheDocument()
  expect(screen.getByText(/2020, 2021, 2022/)).toBeInTheDocument()
  expect(screen.getByText(/62.000 km/)).toBeInTheDocument()
  expect(screen.getByText(/no un historial de precios/)).toBeInTheDocument()
  expect(screen.queryByText(/Promedio del segmento/)).not.toBeInTheDocument()
})

it('discloses approximate grouped references, stale evidence and unknown mileage', () => {
  render(<DepreciationResult projection={projection} reference={{ ...reference,
    reference_count: 2, approximate_model: 'Corolla', stale: true }} kilometers={null} />)
  expect(screen.getByText(/2 referencias compatibles/)).toBeInTheDocument()
  expect(screen.getByText(/modelo similar: Corolla/)).toBeInTheDocument()
  expect(screen.getByText(/pueden estar desactualizados/)).toBeInTheDocument()
  expect(screen.getByText(/Kilometraje no informado/)).toBeInTheDocument()
})

it('keeps appreciation visible without clipping the curve or treating it as a zero loss', () => {
  render(<DepreciationResult projection={{ ...projection, annual_depreciation_percent: -10,
    points: projection.points.map((point) => ({ ...point, value: 22000, retained_percent: 110 })) }}
    reference={reference} kilometers={0} />)
  expect(screen.getByText('-10% anual')).toBeInTheDocument()
  expect(screen.getByText(/aumento estimado/)).toBeInTheDocument()
  expect(screen.getByText(/0 km/)).toBeInTheDocument()
})
