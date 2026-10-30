import { chartGeometry, formatPercent, referenceLines } from '@shared/depreciation/presentation'

const projection = {
  current_value: 20000, currency: 'USD' as const, annual_depreciation_percent: 10,
  points: [{ years: 1, value: 18000, retained_percent: 90 },
    { years: 3, value: 14580, retained_percent: 72.9 }, { years: 5, value: 11809.8, retained_percent: 59.049 }],
}

it('preserves the web chart coordinates and formats retained percentages', () => {
  const chart = chartGeometry(projection)
  expect(chart.values.map(point => point.years)).toEqual([0, 1, 3, 5])
  expect(chart.coordinates[0]).toEqual({ x: 30, y: 40 })
  expect(chart.coordinates[3]).toEqual({ x: 710, y: 105.5216 })
  expect(chart.path).toBe('M30,40 L166,56 L438,83.36 L710,105.5216')
  expect(formatPercent(59.049)).toBe('59%')
  expect(formatPercent(72.9)).toBe('72,9%')
  expect(formatPercent(-10)).toBe('-10%')
})

it('keeps appreciation inside the chart and all reference disclosures', () => {
  const chart = chartGeometry({ ...projection, points: [{ years: 5, value: 22000, retained_percent: 110 }] })
  expect(chart.coordinates[1].y).toBe(40)
  expect(referenceLines({ source_date: '2026-10-19', years_used: [2020, 2021],
    reference_count: 2, approximate_model: 'Corolla', stale: true })).toEqual([
    'Usamos precios de referencia ACARA de distintos años de modelo, no un historial de precios.',
    'Años de referencia: 2020, 2021.',
    'Fecha de referencia: 2026-10-19.',
    'Estimación con 2 referencias compatibles.',
    'Referencia aproximada de un modelo similar: Corolla.',
  ])
})
