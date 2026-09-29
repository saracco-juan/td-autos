import { describe, expect, it } from 'vitest'
import { googleErrorMessage } from './googleErrors'

describe('googleErrorMessage', () => {
  it.each([
    ['google_cancelled', 'Se canceló el registro con Google.'],
    ['google_failed', 'No se pudo completar el registro con Google. Intente nuevamente.'],
    ['email_in_use', 'El email ya está en uso.'],
  ])('maps %s to its Spanish message', (code, message) => {
    expect(googleErrorMessage(code)).toBe(message)
  })

  it('returns undefined for unknown or missing codes', () => {
    expect(googleErrorMessage('<script>')).toBeUndefined()
    expect(googleErrorMessage(null)).toBeUndefined()
  })
})
