export type DetailContext = {
  usageLabel?: string
  priorityLabel?: string
  listingId: number
  score: number
  factors: { usage: number; body: number; comfort: number; priority: number | null }
  returnTo: string
}

export function readDetailReturn(state: unknown, context: DetailContext | null): { to: string; label: string } {
  if (state && typeof state === 'object' && 'returnTo' in state && state.returnTo === '/favoritos') {
    return { to: '/favoritos', label: 'Volver a favoritos' }
  }
  return { to: context?.returnTo ?? '/recomendaciones', label: 'Volver a recomendados' }
}

const score = (value: unknown): value is number => typeof value === 'number'
  && Number.isFinite(value) && value >= 0 && value <= 100

// History carries recommendation context only, never a fallback copy of the vehicle detail.
export function readDetailContext(state: unknown, id: number | null): DetailContext | null {
  if (!state || typeof state !== 'object' || !('vehicleDetail' in state)) return null
  const value = state.vehicleDetail as Partial<DetailContext> | null
  if (!value || typeof value !== 'object' || value.listingId !== id || !score(value.score)
    || typeof value.returnTo !== 'string' || !/^\/recomendaciones(?:\?[^#]*)?$/.test(value.returnTo)) return null
  const factors = value.factors
  if (!factors || !score(factors.usage) || !score(factors.body) || !score(factors.comfort)
    || (factors.priority !== null && !score(factors.priority))) return null
  const label = (input: unknown) => typeof input === 'string' && input.trim().length <= 120 ? input.trim() || undefined : undefined
  return { ...value as DetailContext, usageLabel: label(value.usageLabel), priorityLabel: label(value.priorityLabel) }
}
