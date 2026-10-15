import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpError, NetworkError } from '../../lib/http'
import { INACTIVE_MESSAGE, PAUSED_TEXT, inactiveBody } from './fixtures'
import { inactiveSubscription, pausedInventoryText } from './inactiveSubscription'

describe('inactiveSubscription', () => {
  it('reads the message and the data of the 403 that blocks an inactive subscription', () => {
    expect(inactiveSubscription(new HttpError(403, inactiveBody()))).toEqual({
      message: INACTIVE_MESSAGE,
      vigenteHasta: '2026-10-10',
      retencionHasta: '2026-11-13',
      vehiculosConservados: 2,
    })
  })

  it('does not depend on the text of the message', () => {
    expect(inactiveSubscription(new HttpError(403, inactiveBody({ message: 'Otro texto' })))?.message).toBe('Otro texto')
  })

  it('tolerates a body without the optional data', () => {
    expect(inactiveSubscription(new HttpError(403, { message: INACTIVE_MESSAGE, code: 'subscription_inactive' }))).toEqual({
      message: INACTIVE_MESSAGE,
      vigenteHasta: null,
      retencionHasta: null,
      vehiculosConservados: 0,
    })
  })

  it.each([
    ['another 403', new HttpError(403, { message: 'Tu cuenta está pendiente de aprobación.' })],
    ['the same text without the code', new HttpError(403, { message: INACTIVE_MESSAGE })],
    ['a 403 without a body', new HttpError(403, undefined)],
    ['the code under another status', new HttpError(500, inactiveBody())],
    ['a network failure', new NetworkError(new Error('down'))],
    ['something that is not an error', 'x'],
  ])('returns null for %s', (_label, error) => {
    expect(inactiveSubscription(error)).toBeNull()
  })
})

describe('pausedInventoryText', () => {
  const info = { message: '', vigenteHasta: '2026-10-10', retencionHasta: '2026-11-13', vehiculosConservados: 2 }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 15, 12))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('says how many vehicles are kept, until when and that they are deleted after that', () => {
    expect(pausedInventoryText(info)).toBe(PAUSED_TEXT)
  })

  it('uses the singular for one vehicle', () => {
    expect(pausedInventoryText({ ...info, vehiculosConservados: 1 })).toBe(
      'Tu suscripción venció el 10/10/2026 y terminó el período de gracia. Tu vehículo no se publica, pero lo conservamos hasta el 13/11/2026; después se elimina definitivamente.',
    )
  })

  it('says that vehicles can be loaded again when there is nothing to keep yet', () => {
    expect(pausedInventoryText({ ...info, vehiculosConservados: 0 })).toBe(
      'Tu suscripción venció el 10/10/2026 y terminó el período de gracia. Cuando se apruebe la renovación vas a poder volver a cargar vehículos.',
    )
  })

  it.each(['2026-10-15', '2026-10-14'])('says the vehicles were deleted once the retention is reached (%s)', (retencionHasta) => {
    expect(pausedInventoryText({ ...info, retencionHasta, vehiculosConservados: 0 })).toBe(
      'Tu suscripción venció el 10/10/2026 y terminó el período de gracia. Tus vehículos se eliminaron porque pasaron 30 días sin renovación; cuando se apruebe la renovación vas a poder volver a cargar vehículos.',
    )
  })
})
