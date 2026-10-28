import type { ExchangeRate, Recommendation, RecommendationStatus } from './matching'

// Thousands with a dot (Argentine style); done by hand so it does not depend on the ICU data of the runtime.
export function groupThousands(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

export function formatKilometers(value: number): string {
  return `${groupThousands(value)} km`
}

export function formatPrice(value: number, currency: 'ARS' | 'USD' = 'ARS'): string {
  return `${currency === 'USD' ? 'US$' : '$'} ${groupThousands(value)}`
}

export const displayScore = (value: number) => value.toLocaleString('es-AR', { maximumFractionDigits: 1 })

export function recommendationTitle({ vehicle }: Pick<Recommendation, 'vehicle'>): string {
  return [vehicle.marca, vehicle.modelo, vehicle.version, vehicle.anio].filter(Boolean).join(' ')
}

export function compatibilityLabel({ score }: Pick<Recommendation, 'score'>): string {
  return `${displayScore(score)}% de compatibilidad`
}

// The other currency of the published price; USD is unknown when there was no quote.
export function equivalentPriceLabel(result: Recommendation): string {
  const equivalent = result.published_currency === 'USD' ? result.price_ars : result.price_usd
  const currency = result.published_currency === 'USD' ? 'ARS' : 'USD'
  return equivalent === null ? 'Equivalente en USD no disponible.' : `Equivalente: ${formatPrice(equivalent, currency)}`
}

// One message per backend warning code, in a fixed order.
export function warningMessages(result: Recommendation): string[] {
  const messages: string[] = []
  if (result.warnings.includes('budget_exceeded')) {
    messages.push(`Supera tu presupuesto en ${displayScore(result.budget_excess_percent)}%.`)
  }
  if (result.warnings.includes('body_mismatch')) messages.push('No coincide con la carrocería elegida.')
  if (result.warnings.includes('resale_unavailable')) {
    messages.push('Sin estimación de reventa: compatibilidad parcial sobre los factores conocidos, con descuento de 10 puntos por falta de datos, no por mala reventa.')
  }
  if (result.warnings.includes('resale_stale')) {
    messages.push('Reventa calculada con la última evidencia disponible; actualización pendiente.')
  }
  return messages
}

export function componentsSummary({ components }: Pick<Recommendation, 'components'>): string {
  const priority = components.priority === null ? 'no disponible' : displayScore(components.priority)
  return `Uso: ${displayScore(components.usage)} · Carrocería: ${displayScore(components.body)} · Prioridad: ${priority} · Confort: ${displayScore(components.comfort)} (sobre 100).`
}

export function budgetPenaltyNote({ budget_penalty }: Pick<Recommendation, 'budget_penalty'>): string {
  return `Descuento por presupuesto: ${displayScore(budget_penalty)} puntos. La compatibilidad expresa nuestras reglas, no una probabilidad de satisfacción.`
}

// The quote line under the counter and, when the quote is missing or old, the warning that explains it.
export function exchangeRateNotice(exchange: ExchangeRate | null | undefined): { summary: string | null; warning: string | null } {
  const quote = exchange?.quote
  const summary = quote
    ? `Dólar oficial venta · ${quote.source} · ${formatPrice(quote.sell)} · ${new Date(quote.updated_at).toLocaleString('es-AR')}`
    : null
  let warning: string | null = null
  if (!quote) warning = 'Sin cotización disponible: solo evaluamos precios publicados en pesos, sin equivalente en dólares.'
  else if (exchange?.stale) warning = 'Última cotización disponible: no se pudo actualizar.'
  return { summary, warning }
}

const EMPTY_TITLES: Record<RecommendationStatus, string> = {
  diagnosis_incomplete: 'Completá tu diagnóstico para ver recomendaciones.',
  resale_pending: 'Las recomendaciones por reventa todavía no están disponibles.',
  ready: 'No encontramos vehículos que coincidan con tu diagnóstico.',
}

// Why the list is empty: filters that leave nothing out of a ready ranking, or no ranking for this diagnosis.
export function emptyStateCopy(status: RecommendationStatus, filtered: boolean): { title: string; hint: string } {
  if (filtered && status === 'ready') {
    return {
      title: 'No encontramos vehículos que cumplan estos filtros.',
      hint: 'Quitá o limpiá los filtros para volver a ver tus recomendaciones.',
    }
  }
  return { title: EMPTY_TITLES[status], hint: 'Ajustá el diagnóstico para buscar otras opciones.' }
}

export function vehicleCount(count: number): string {
  return `Mostrando ${count} ${count === 1 ? 'vehículo' : 'vehículos'}`
}
