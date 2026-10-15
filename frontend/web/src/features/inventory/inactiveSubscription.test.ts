import { describe, expect, it } from 'vitest'
import { HttpError, NetworkError } from '../../lib/http'
import { inactiveSubscriptionMessage } from './inactiveSubscription'

const MESSAGE = 'Tu suscripción está inactiva. Subí el comprobante de renovación para volver a gestionar tu inventario.'

describe('inactiveSubscriptionMessage', () => {
  it('returns the message of the 403 that blocks an inactive subscription', () => {
    expect(inactiveSubscriptionMessage(new HttpError(403, { message: MESSAGE }))).toBe(MESSAGE)
  })

  it.each([
    ['another 403', new HttpError(403, { message: 'Tu cuenta está pendiente de aprobación.' })],
    ['a 403 without a body', new HttpError(403, undefined)],
    ['the same text under another status', new HttpError(500, { message: MESSAGE })],
    ['a network failure', new NetworkError(new Error('down'))],
    ['something that is not an error', 'x'],
  ])('returns null for %s', (_label, error) => {
    expect(inactiveSubscriptionMessage(error)).toBeNull()
  })
})
