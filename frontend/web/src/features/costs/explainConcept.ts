import { formatPrice, groupThousands } from '../inventory/format'
import type { CostBreakdown, FuelType } from './types'

export type Concept = 'fuel' | 'insurance' | 'patente' | 'maintenance' | 'transfer' | 'price'

const FUEL_NAMES: Record<'nafta' | 'diesel' | 'gnc', string> = { nafta: 'nafta', diesel: 'diésel', gnc: 'GNC' }
const CAR_BY_FUEL: Record<FuelType, string> = {
  nafta: 'un auto a nafta',
  diesel: 'un auto a diésel',
  gnc: 'un auto a GNC',
  hibrido: 'un auto híbrido',
  electrico: 'un auto eléctrico',
}

// Argentine decimals: 3.2 -> "3,2", 8 -> "8". Rounded to two decimals so float noise (0.07 * 100) never shows.
function decimal(value: number): string {
  return String(Number(value.toFixed(2))).replace('.', ',')
}

const percent = (rate: number) => `${decimal(rate * 100)}%`

const withRounding = (text: string, breakdown: CostBreakdown) =>
  `${text} Redondeamos para arriba a $${groupThousands(breakdown.rounding)}.`

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
      return withRounding(
        `${groupThousands(fuel.km_per_month)} km por mes × ${decimal(fuel.consumption_l_100km)} ${unit} cada 100 km × ${formatPrice(fuel.unit_price)} ${priceLabel} = ${money}. Usamos el consumo más alto del auto (urbano o ruta).`,
        breakdown,
      )
    }
    case 'insurance': {
      const { annual_rate: rate, coverage } = breakdown.insurance
      const label = coverage === 'todo_riesgo' ? 'todo riesgo' : 'terceros completo'
      return withRounding(`${percent(rate)} anual del valor del auto para ${label}, dividido 12 meses = ${money} por mes.`, breakdown)
    }
    case 'patente': {
      const { province, province_known: known, annual_rate: rate } = breakdown.patente
      const lead = known
        ? `Alícuota anual de ${percent(rate)} en ${province}, sobre`
        : `No reconocimos la provincia, así que usamos la alícuota más alta (${percent(rate)}) sobre`
      return withRounding(`${lead} el valor del auto, dividido 12 meses = ${money} por mes.`, breakdown)
    }
    case 'maintenance': {
      const m = breakdown.maintenance
      const years = `${m.age_years} ${m.age_years === 1 ? 'año' : 'años'}`
      const extras = [
        m.turbo_factor === null ? '' : `, turbo (×${decimal(m.turbo_factor)})`,
        m.automatic_factor === null ? '' : `, caja automática (×${decimal(m.automatic_factor)})`,
      ].join('')
      return withRounding(
        `Service anual de referencia para ${CAR_BY_FUEL[m.fuel_type]} (${formatPrice(m.annual_base)}), ajustado por antigüedad (${years}, ×${decimal(m.age_factor)}) y kilometraje (${groupThousands(m.km)} km, ×${decimal(m.km_factor)})${extras}, dividido 12 meses = ${money} por mes.`,
        breakdown,
      )
    }
    case 'transfer': {
      const t = breakdown.transfer
      const stamp = t.province_known
        ? `sellos de ${t.province} (${percent(t.stamp_rate)})`
        : `sellos (${percent(t.stamp_rate)}, el más alto porque no reconocimos la provincia)`
      return withRounding(
        `Arancel del registro (${percent(t.dnrpa_rate)}) + ${stamp} sobre el valor del auto, más ${formatPrice(t.fixed_costs)} de gastos fijos (formularios, verificación y gestor) = ${money}.`,
        breakdown,
      )
    }
    case 'price':
      return `Precio publicado en ${formatPrice(usd?.published ?? 0, 'USD')}, convertido al dólar oficial venta de ${formatPrice(usd?.rate ?? 0)}.`
  }
}
