import { describe, expect, it } from 'vitest'
import { googleErrorMessage } from './googleErrors'

describe('googleErrorMessage', () => {
  it.each([
    ['google_cancelled', 'Se canceló el ingreso con Google.'],
    ['google_failed', 'No se pudo completar el ingreso con Google. Intentá nuevamente.'],
    ['email_in_use', 'El email ya está en uso.'],
  ])('maps %s to its Spanish message', (code, message) => {
    expect(googleErrorMessage(code)).toBe(message)
  })

  it('returns undefined for unknown or missing codes', () => {
    expect(googleErrorMessage('<script>')).toBeUndefined()
    expect(googleErrorMessage(null)).toBeUndefined()
  })
})
