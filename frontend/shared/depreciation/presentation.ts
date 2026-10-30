import type { DepreciationProjection, DepreciationReference } from './types'

export const depreciationCopy = {
  subtitle: 'Estimación a partir del precio publicado y de referencias de vehículos comparables.',
  chartLabel: 'Proyección del valor publicado a 1, 3 y 5 años',
  legend: 'Este vehículo · estimación a partir del precio publicado',
  insufficient: 'No hay datos suficientes para estimar la depreciación.',
  insufficientHint: 'Necesitamos un precio publicado válido y referencias comparables suficientes. Podés volver a la ficha o consultar otro vehículo.',
  condition: 'El uso, el mantenimiento y el estado pueden modificar el valor de reventa. Esta estimación no aplica ajustes por kilometraje.',
  appreciation: 'El porcentaje negativo indica un aumento estimado del valor según las referencias disponibles.',
  stale: 'Los valores de referencia pueden estar desactualizados.',
  caveat: 'Aplicamos la misma tasa anual de forma acumulada al precio publicado. Es una estimación orientativa, sin ajuste por inflación ni tipo de cambio. No garantiza un precio futuro ni reemplaza una tasación.',
  retained: 'Los porcentajes indican el valor conservado respecto del precio publicado.',
} as const

export const formatPercent = (value: number) => `${value.toLocaleString('es-AR', { maximumFractionDigits: 1 })}%`
export const yearLabel = (years: number) => `${years} ${years === 1 ? 'año' : 'años'}`

export function mileageDescription(kilometers: number | null): string {
  return kilometers === null ? 'Kilometraje no informado.' : `Kilometraje publicado: ${kilometers.toLocaleString('es-AR')} km.`
}

export function referenceLines(reference: DepreciationReference): string[] {
  return [
    'Usamos precios de referencia ACARA de distintos años de modelo, no un historial de precios.',
    `Años de referencia: ${reference.years_used.join(', ')}.`,
    ...(reference.source_date ? [`Fecha de referencia: ${reference.source_date}.`] : []),
    ...(reference.reference_count > 1 ? [`Estimación con ${reference.reference_count} referencias compatibles.`] : []),
    ...(reference.approximate_model ? [`Referencia aproximada de un modelo similar: ${reference.approximate_model}.`] : []),
  ]
}

// Both clients draw the server's projection; no forecast is calculated on the client.
export function chartGeometry(projection: DepreciationProjection, width = 740, height = 240) {
  const values = [{ years: 0, value: projection.current_value }, ...projection.points]
  const maximum = Math.max(...values.map(({ value }) => value))
  const coordinates = values.map(({ years, value }) => ({
    x: (30 + years / 5 * 680) * (width / 740),
    y: (200 - value / maximum * 160) * (height / 240),
  }))
  const path = coordinates.map(({ x, y }, index) => `${index === 0 ? 'M' : 'L'}${x},${y}`).join(' ')
  return { values, coordinates, path }
}
