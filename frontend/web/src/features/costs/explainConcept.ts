import { formatPrice, groupThousands } from '../inventory/format'
import type { BodyType, CostBreakdown, FuelType } from './types'

export type Concept = 'fuel' | 'charging' | 'insurance' | 'patente' | 'maintenance' | 'transfer' | 'price'

const FUEL_NAMES: Record<'nafta' | 'diesel' | 'gnc', string> = { nafta: 'nafta', diesel: 'diésel', gnc: 'GNC' }
// Why the fuel factor applies, in the maintenance text ("× 1,15 por GNC").
const FUEL_REASON: Record<FuelType, string> = {
  nafta: 'ser a nafta',
  diesel: 'ser diésel',
  gnc: 'GNC',
  hibrido: 'ser híbrido',
  electrico: 'ser eléctrico',
}

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
  const body = insurance.body_type === null ? null : BODY_PHRASES[insurance.body_type]
  const zone = `× ${decimal(insurance.zone_factor)} por la zona${insurance.province_known ? ` (${insurance.province})` : ''}`
  const yearlyValue = `${percent(insurance.value_rate)} anual del valor del auto, dividido 12 meses`

  if (insurance.coverage === 'todo_riesgo') {
    if (insurance.by_value || insurance.tr_ratio === null) return `Todo riesgo: ${yearlyValue} = ${money} por mes.`
    return `Todo riesgo: terceros completo (${formatPrice(insurance.terceros_completo)}) × ${decimal(insurance.tr_ratio)}${body ? ` para ${body}` : ''} = ${money} por mes.`
  }
  if (insurance.by_value) return `Terceros completo: ${yearlyValue}, ${zone} = ${money} por mes.`
  return `Terceros completo${body ? ` para ${body}` : ''}: ${formatPrice(Math.round(insurance.base_monthly))} por mes de referencia, ${zone} = ${money} por mes. Sale de cotizaciones publicadas en octubre de 2026.`
}

function explainPatente(patente: CostBreakdown['patente'], money: string): string {
  const where = patente.province_known ? ` en ${patente.province}` : ''
  const monthly = `dividido 12 meses = ${money} por mes.`
  if (patente.method === 'scale') {
    const annual = `${formatPrice(patente.annual)} al año`
    if (!patente.bracket_fixed) {
      return `Patente${where}: ${percent(patente.rate)} del valor del auto (${formatPrice(patente.base)}) = ${annual}, ${monthly}`
    }
    return `Patente${where}: sobre el valor del auto (${formatPrice(patente.base)}) corresponde ${formatPrice(patente.bracket_fixed)} + ${percent(patente.rate)} de lo que supera ${formatPrice(patente.bracket_from ?? 0)} = ${annual}, ${monthly}`
  }
  if (patente.method === 'bracket_rate') {
    return `Patente${where}: ${percent(patente.rate)} anual del valor del auto, ${monthly}`
  }
  return `Alícuota anual de ${percent(patente.rate)}${where ? `${where},` : ''} sobre el valor del auto, ${monthly}`
}

function explainMaintenance(m: CostBreakdown['maintenance'], money: string): string {
  const body = m.body_type === null ? '' : ` para ${BODY_PHRASES[m.body_type]}`
  const age = m.age_factor === 1 ? '' : ` × ${decimal(m.age_factor)} por antigüedad (${m.age_years} ${m.age_years === 1 ? 'año' : 'años'})`
  const fuel = m.fuel_factor === 1 ? '' : ` × ${decimal(m.fuel_factor)} por ${FUEL_REASON[m.fuel_type]}`
  return `${groupThousands(m.km_per_month)} km por mes × $ ${decimal(m.per_km)} por km${body} (service oficial)${age}${fuel} = ${money} por mes.`
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
    case 'maintenance':
      return explainMaintenance(breakdown.maintenance, money)
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
