import { equipmentValue, specificationGroups, type DetailVehicle, type SpecificationRow } from '../vehicles/detail'
import { EQUIPMENT_GROUPS, type EquipmentFacts } from '../vehicles/equipment'
import { formatPrice } from '../recommendations/format'
import { formatDate } from '../costs/format'
import type { OwnershipCosts } from '../costs/types'
import type { Recommendation } from '../recommendations/matching'

export type ComparisonEntry = {
  id: number
  detail: { vehicle: DetailVehicle & EquipmentFacts; dealer: { id: number; nombre: string; provincia: string | null } }
  recommendation: Pick<Recommendation, 'score' | 'components' | 'warnings' | 'budget_excess_percent'>
  costs: Pick<OwnershipCosts, 'inputs' | 'purchase' | 'monthly' | 'yearly' | 'rates_updated_at'>
}
type Group = { title: string; rows: SpecificationRow[] }
const score = (value: number | null) => value === null ? 'No disponible'
  : `${value.toLocaleString('es-AR', { maximumFractionDigits: 1 })}/100`

export function comparisonGroups({ detail: { vehicle, dealer }, recommendation, costs }: ComparisonEntry): Group[] {
  const partial = costs.monthly.not_estimated.length > 0 ? ' (parcial)' : ''
  return [
    { title: 'Publicación', rows: [
      { label: 'Precio publicado', value: vehicle.precio === null || vehicle.moneda === null
        ? 'No disponible' : formatPrice(vehicle.precio, vehicle.moneda) },
      { label: 'Coincidencia', value: score(recommendation.score).replace('/100', '%') },
      { label: 'Fuente', value: `Concesionaria verificada · ${dealer.nombre}` },
    ] },
    ...specificationGroups(vehicle),
    ...Object.entries(EQUIPMENT_GROUPS).map(([title, fields]) => ({ title,
      rows: fields.map(([key, label]) => ({ label, value: equipmentValue(vehicle[key]) })),
    })),
    { title: 'Ventajas según tu diagnóstico', rows: [
      { label: 'Compatibilidad con tu uso', value: score(recommendation.components.usage) },
      { label: 'Compatibilidad con tu carrocería', value: score(recommendation.components.body) },
      { label: 'Compatibilidad con tu prioridad', value: score(recommendation.components.priority) },
      { label: 'Compatibilidad con tu confort', value: score(recommendation.components.comfort) },
      { label: 'Advertencias', value: [
        recommendation.warnings.includes('budget_exceeded') ? 'Supera tu presupuesto.' : '',
        recommendation.warnings.includes('body_mismatch') ? 'No coincide con tu carrocería.' : '',
        recommendation.warnings.includes('resale_unavailable') ? 'Reventa no disponible: compatibilidad parcial.' : '',
        recommendation.warnings.includes('resale_stale') ? 'Reventa pendiente de actualización.' : '',
      ].filter(Boolean).join(' ') || 'Sin advertencias de compatibilidad.' },
    ] },
    { title: 'Costos estimados en ARS', rows: [
      { label: 'Compra con transferencia', value: formatPrice(costs.purchase.total) },
      { label: 'Total mensual', value: formatPrice(costs.monthly.total) + partial },
      { label: 'Total anual con service', value: formatPrice(costs.yearly.total) + partial },
      { label: 'Costos no incluidos', value: costs.monthly.not_estimated.join(', ') || 'Ninguno informado' },
      { label: 'Kilómetros por mes', value: `${costs.inputs.km_per_month.toLocaleString('es-AR')} km (${costs.inputs.km_source === 'diagnostico' ? 'tu diagnóstico' : 'valor estimado'})` },
      { label: 'Seguro', value: costs.inputs.coverage === 'todo_riesgo' ? 'Todo riesgo' : 'Terceros completo' },
      { label: 'Valores actualizados al', value: formatDate(costs.rates_updated_at) },
    ] },
  ]
}

