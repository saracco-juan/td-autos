import { equipmentValue, specificationGroups, type DetailVehicle, type SpecificationRow } from '../vehicles/detail'
import { EQUIPMENT_GROUPS, type EquipmentFacts } from '../vehicles/equipment'
import { formatPrice } from '../recommendations/format'
import { formatDate } from '../costs/format'
import type { OwnershipCosts } from '../costs/types'
import type { Recommendation } from '../recommendations/matching'

export type ComparisonEntry = {
  id: number
  detail: { vehicle: DetailVehicle & EquipmentFacts; dealer: { id: number; nombre: string; provincia: string | null } }
  recommendation: Pick<Recommendation, 'score' | 'components' | 'warnings' | 'budget_excess_percent'> | null
  costs: Pick<OwnershipCosts, 'inputs' | 'purchase' | 'monthly' | 'yearly' | 'rates_updated_at'>
}
type Group = { title: string; rows: SpecificationRow[] }
const score = (value: number | null) => value === null ? 'No disponible'
  : `${value.toLocaleString('es-AR', { maximumFractionDigits: 1 })}/100`

function diagnosisRows(recommendation: ComparisonEntry['recommendation']): SpecificationRow[] {
  const unavailable = 'No disponible'
  const compatibility = recommendation?.components
  const warnings = new Set(recommendation?.warnings ?? [])
  const warningMessages: string[] = []
  if (warnings.has('budget_exceeded')) warningMessages.push('Supera tu presupuesto.')
  if (warnings.has('body_mismatch')) warningMessages.push('No coincide con tu carrocería.')
  if (warnings.has('resale_unavailable')) warningMessages.push('Reventa no disponible: compatibilidad parcial.')
  if (warnings.has('resale_stale')) warningMessages.push('Reventa pendiente de actualización.')

  return [
    { label: 'Compatibilidad con tu uso', value: compatibility ? score(compatibility.usage) : unavailable },
    { label: 'Compatibilidad con tu carrocería', value: compatibility ? score(compatibility.body) : unavailable },
    { label: 'Compatibilidad con tu prioridad', value: compatibility ? score(compatibility.priority) : unavailable },
    { label: 'Compatibilidad con tu confort', value: compatibility ? score(compatibility.comfort) : unavailable },
    { label: 'Advertencias', value: recommendation
      ? warningMessages.join(' ') || 'Sin advertencias de compatibilidad.' : unavailable },
  ]
}

function costRows(costs: ComparisonEntry['costs']): SpecificationRow[] {
  const partial = costs.monthly.not_estimated.length > 0 ? ' (parcial)' : ''
  return [
    { label: 'Compra con transferencia', value: formatPrice(costs.purchase.total) },
    { label: 'Total mensual', value: formatPrice(costs.monthly.total) + partial },
    { label: 'Total anual con service', value: formatPrice(costs.yearly.total) + partial },
    { label: 'Costos no incluidos', value: costs.monthly.not_estimated.join(', ') || 'Ninguno informado' },
    { label: 'Kilómetros por mes', value: `${costs.inputs.km_per_month.toLocaleString('es-AR')} km (${costs.inputs.km_source === 'diagnostico' ? 'tu diagnóstico' : 'valor estimado'})` },
    { label: 'Seguro', value: costs.inputs.coverage === 'todo_riesgo' ? 'Todo riesgo' : 'Terceros completo' },
    { label: 'Valores actualizados al', value: formatDate(costs.rates_updated_at) },
  ]
}

export function comparisonGroups({ detail: { vehicle, dealer }, recommendation, costs }: ComparisonEntry): Group[] {
  const unavailable = 'No disponible'
  return [
    { title: 'Publicación', rows: [
      { label: 'Precio publicado', value: vehicle.precio === null || vehicle.moneda === null
        ? 'No disponible' : formatPrice(vehicle.precio, vehicle.moneda) },
      { label: 'Coincidencia', value: recommendation ? score(recommendation.score).replace('/100', '%') : unavailable },
      { label: 'Fuente', value: `Concesionaria verificada · ${dealer.nombre}` },
    ] },
    ...specificationGroups(vehicle),
    ...Object.entries(EQUIPMENT_GROUPS).map(([title, fields]) => ({ title,
      rows: fields.map(([key, label]) => ({ label, value: equipmentValue(vehicle[key]) })),
    })),
    { title: 'Ventajas según tu diagnóstico', rows: diagnosisRows(recommendation) },
    { title: 'Costos estimados en ARS', rows: costRows(costs) },
  ]
}

