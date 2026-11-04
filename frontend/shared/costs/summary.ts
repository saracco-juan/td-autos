import { formatPrice } from '../recommendations/format'
import { explainConcept, type Concept } from './explainConcept'
import { formatDate } from './format'
import type { OwnershipCosts } from './types'

// The lines of the cost blocks, shared by web and mobile so labels, values, explanations and copy never drift apart.
export type CostLine = { label: string; value: string; strong?: boolean; info?: { name: string; text: string } }

const perMonth = (value: number) => `${formatPrice(value)} por mes`

// "Para mantenerlo": monthly concepts, the monthly total, the yearly service and the yearly total.
export function monthlyLines(data: OwnershipCosts): { lines: CostLine[]; note: string | null } {
  const { monthly, yearly, breakdown } = data
  const info = (name: string, concept: Concept, amount: number | null) => ({ name, text: explainConcept(concept, breakdown, amount) })
  // Electric cars have no fuel to price yet: charging costs are announced, not estimated.
  const electric = data.vehicle.fuel === 'electrico'
  const fuelValue = monthly.fuel === null ? (electric ? 'Próximamente' : 'No podemos estimarlo') : perMonth(monthly.fuel)
  const lines: CostLine[] = [
    { label: 'Combustible', value: fuelValue, info: info('Combustible', electric && monthly.fuel === null ? 'charging' : 'fuel', monthly.fuel) },
    { label: 'Seguro', value: perMonth(monthly.insurance), info: info('Seguro', 'insurance', monthly.insurance) },
    { label: 'Patente', value: perMonth(monthly.patente), info: info('Patente', 'patente', monthly.patente) },
    { label: 'Total por mes', value: formatPrice(monthly.total), strong: true },
    { label: 'Service (por año)', value: formatPrice(yearly.service), info: info('Service', 'service', yearly.service) },
    { label: 'Total por año', value: formatPrice(yearly.total), strong: true },
  ]
  const note = monthly.not_estimated.includes('fuel')
    ? (electric ? 'El total no incluye la carga del auto.' : 'El total no incluye el combustible.')
    : null
  return { lines, note }
}

// "Para comprarlo": price (named by each app), transfer and total, the dollar quote note and the budget message.
export function purchaseLines(data: OwnershipCosts, priceLabel: string) {
  const { purchase, vehicle, exchange_rate: rate, breakdown } = data
  const usd = vehicle.published_currency === 'USD' && rate ? { published: vehicle.published_price, rate: rate.sell } : undefined
  const lines: CostLine[] = [
    {
      label: priceLabel,
      value: formatPrice(purchase.price),
      info: usd ? { name: 'Precio publicado', text: explainConcept('price', breakdown, purchase.price, usd) } : undefined,
    },
    { label: 'Transferencia', value: formatPrice(purchase.transfer), info: { name: 'Transferencia', text: explainConcept('transfer', breakdown, purchase.transfer) } },
    { label: 'Total', value: formatPrice(purchase.total), strong: true },
  ]
  const usdNote = usd && rate
    ? `Publicado en ${formatPrice(vehicle.published_price, 'USD')}, al dólar oficial venta de ${formatPrice(rate.sell)} (${formatDate(rate.updated_at)}).`
    : null
  const budget = purchase.budget
    ? {
        fits: purchase.budget.fits,
        message: purchase.budget.fits
          ? `Entra en tu presupuesto (te sobran ${formatPrice(purchase.budget.difference)}).`
          : `Supera tu presupuesto por ${formatPrice(Math.abs(purchase.budget.difference))}.`,
      }
    : null
  return { lines, usdNote, budget }
}
