import { formatPrice, groupThousands } from '@shared/recommendations/format'
import type { BodyType, CostBreakdown } from './types'

export type Concept = 'fuel' | 'charging' | 'insurance' | 'patente' | 'service' | 'transfer' | 'price'

const FUEL_NAMES: Record<'nafta' | 'diesel' | 'gnc', string> = { nafta: 'nafta', diesel: 'diésel', gnc: 'GNC' }
// Why the fuel factor applies, in the service text ("× 1,15 por GNC").
const FUEL_REASONS: { factor: number; reason: string }[] = [
  { factor: 1.15, reason: 'GNC' },
  { factor: 0.5, reason: 'ser eléctrico' },
]

// Argentine decimals: 3.2 -> "3,2", 8 -> "8". Rounded to two decimals so float noise (0.07 * 100) never shows.
function decimal(value: number): string {
  return String(Number(value.toFixed(2))).replace('.', ',')
}

const BODY_PHRASES: Record<BodyType, string> = {
  hatchback: 'un hatchback',
  sedan: 'un sedán',
  rural: 'una rural',
  suv: 'un SUV',
  pickup: 'una pickup',
  furgon: 'un furgón',
}

const percent = (rate: number) => `${decimal(rate * 100)}%`

function explainInsurance(insurance: CostBreakdown['insurance'], money: string): string {
  if (insurance.coverage === 'todo_riesgo' && insurance.tr_ratio !== null) {
    return `Todo riesgo: terceros completo (${formatPrice(insurance.terceros_completo)}) × ${decimal(insurance.tr_ratio)} = ${money} por mes.`
  }
  const floor = formatPrice(insurance.floor)
  const share = `${percent(insurance.value_rate)} mensual del valor del auto`
  const value = formatPrice(Math.round(insurance.base * insurance.value_rate))
  if (insurance.zone_factor === 1) return `Terceros completo: ${floor} + ${share} (${value}) = ${money} por mes.`
  const zone = `× ${decimal(insurance.zone_factor)} por la zona${insurance.province_known ? ` (${insurance.province})` : ''}`
  return `Terceros completo: (${floor} + ${share}, ${value}) ${zone} = ${money} por mes.`
}

// Why this rate applies, when the rate depends on the age or the body type of the vehicle.
function patenteQualifier(patente: CostBreakdown['patente']): string {
  if (patente.method === 'age_rate' && patente.age_band) {
    const { from_age: from, to_age: to } = patente.age_band
    if (to === null) return `, por ser un auto de más de ${from - 1} años`
    return from === 0 ? `, por ser un auto de hasta ${to} años` : `, por ser un auto de más de ${from - 1} y hasta ${to} años`
  }
  if (patente.method === 'body_rate') return patente.body_kind === 'utility' ? ', con la alícuota de utilitarios' : ', con la alícuota de autos'
  return ''
}

// What the surcharge, the cap and the minimum do to the tax of the scheme; empty when none of them changes it.
function patenteAdjustments(patente: CostBreakdown['patente']): string {
  const capped = patente.cap_applied && patente.cap_rate !== null
  const raised = patente.minimum_applied && patente.minimum !== null
  if (patente.surcharge <= 0 && !capped && !raised) return ''
  let text = ` = ${formatPrice(Math.round(patente.subtotal))}`
  if (patente.surcharge > 0) {
    text += `, más ${percent(patente.surcharge)} de recargo = ${formatPrice(Math.round(patente.subtotal * (1 + patente.surcharge)))}`
  }
  if (capped) text += `, pero el tope es ${percent(patente.cap_rate ?? 0)} del valor`
  if (raised) text += `, pero el mínimo es ${formatPrice(patente.minimum ?? 0)}`
  return capped || raised ? `${text}: ${formatPrice(Math.round(patente.annual))} al año` : `${text} al año`
}

function explainPatente(patente: CostBreakdown['patente'], money: string): string {
  const where = patente.province_known ? ` en ${patente.province}` : ''
  const monthly = `dividido 12 meses = ${money} por mes.`
  if (patente.exempt) {
    return `Patente${where}: el auto tiene ${patente.age} años y desde los ${patente.exempt_from_age} años no se paga patente = ${money} por mes.`
  }
  // The ACARA reference value of the version replaces "valor del auto" when the patente is charged on it.
  const value = patente.base_source === 'acara' ? 'valor de referencia ACARA de esta versión' : 'valor del auto'
  const valueWithBase = `${value} (${formatPrice(patente.base)})`
  const adjustments = patenteAdjustments(patente)
  if (patente.method === 'scale') {
    const annual = adjustments || ` = ${formatPrice(patente.annual)} al año`
    if (!patente.bracket_fixed) {
      return `Patente${where}: ${percent(patente.rate)} del ${valueWithBase}${annual}, ${monthly}`
    }
    return `Patente${where}: sobre el ${valueWithBase} corresponde ${formatPrice(patente.bracket_fixed)} + ${percent(patente.rate)} de lo que supera ${formatPrice(patente.bracket_from ?? 0)}${annual}, ${monthly}`
  }
  const wholeValue = patente.base_source === 'acara' ? valueWithBase : value
  if (patente.method === 'flat') {
    return `Alícuota anual de ${percent(patente.rate)}${where ? `${where},` : ''} sobre el ${wholeValue}${adjustments}, ${monthly}`
  }
  // bracket_rate, age_rate and body_rate: one rate over the whole value.
  return `Patente${where}: ${percent(patente.rate)} anual del ${wholeValue}${patenteQualifier(patente)}${adjustments}, ${monthly}`
}

function explainService(service: CostBreakdown['service'], money: string): string {
  const count = `${service.services_per_year} ${service.services_per_year === 1 ? 'service' : 'services'}`
  // The time rule decides when the km alone would ask for fewer services than the months do.
  const byTime = service.km_per_year / service.interval_km < 12 / service.interval_months
  const frequency = byTime
    ? `Al menos ${service.services_per_year} ${service.services_per_year === 1 ? 'service' : 'services'} por año`
    : `${groupThousands(service.km_per_year)} km al año ÷ ${groupThousands(service.interval_km)} km = ${count}`
  const reference = service.source_label.startsWith('valor de referencia')
  const body = reference && service.body_type !== null ? ` para ${BODY_PHRASES[service.body_type]}` : ''
  const factor = FUEL_REASONS.find((item) => item.factor === service.fuel_factor)
  const fuel = factor ? ` × ${decimal(service.fuel_factor)} por ${factor.reason}` : ''
  return `${frequency} × ${formatPrice(Math.round(service.price_per_service))} (${service.source_label}${body})${fuel} = ${money} al año.`
}

/**
 * Spanish text that shows where an amount comes from, using the real numbers of the vehicle.
 * `amount` is the figure shown on the screen; `usd` is only read for the published price.
 */
export function explainConcept(
  concept: Concept,
  breakdown: CostBreakdown,
  amount: number | null,
  usd?: { published: number; rate: number },
): string {
  const money = amount === null ? '' : formatPrice(amount)
  switch (concept) {
    case 'fuel': {
      const fuel = breakdown.fuel
      if (!fuel) return 'No tenemos datos de consumo de este auto, así que no podemos estimar el combustible.'
      const gnc = fuel.unit === 'm3'
      const unit = gnc ? 'm³' : 'L'
      const priceLabel = gnc ? 'el m³ de GNC' : `el litro de ${FUEL_NAMES[fuel.price_fuel_type]}`
      return `${groupThousands(fuel.km_per_month)} km por mes × ${decimal(fuel.consumption_l_100km)} ${unit} cada 100 km (consumo del auto) × ${formatPrice(fuel.unit_price)} ${priceLabel} = ${money}.`
    }
    case 'charging':
      return 'Pronto vas a poder ver cuánto te cuesta cargarlo.'
    case 'insurance':
      return explainInsurance(breakdown.insurance, money)
    case 'patente':
      return explainPatente(breakdown.patente, money)
    case 'service':
      return explainService(breakdown.service, money)
    case 'transfer': {
      const t = breakdown.transfer
      const stamp = t.province_known
        ? `sellos de ${t.province} (${percent(t.stamp_rate)})`
        : `sellos (${percent(t.stamp_rate)})`
      return (
        `Arancel del registro (${percent(t.dnrpa_rate)}) + ${stamp} sobre el valor del auto, más ${formatPrice(t.fixed_costs)} de gastos fijos (formularios y verificación) = ${money}.`
      )
    }
    case 'price':
      return `Precio publicado en ${formatPrice(usd?.published ?? 0, 'USD')}, convertido al dólar oficial venta de ${formatPrice(usd?.rate ?? 0)}.`
  }
}
