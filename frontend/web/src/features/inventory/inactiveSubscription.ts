import { HttpError } from '../../lib/http'

export const SUBSCRIPTION_PATH = '/concesionaria/suscripcion'

// Start of the text the API sends with the 403 that blocks the inventory of an inactive subscription (RF21).
// The other 403s of these routes (pending dealer, no permission) keep their generic handling.
const INACTIVE_PREFIX = 'Tu suscripción está inactiva'

// The message of that 403, or null when the error is anything else.
export function inactiveSubscriptionMessage(error: unknown): string | null {
  if (!(error instanceof HttpError) || error.status !== 403) return null
  const message = (error.body as { message?: unknown } | null | undefined)?.message
  return typeof message === 'string' && message.startsWith(INACTIVE_PREFIX) ? message : null
}
