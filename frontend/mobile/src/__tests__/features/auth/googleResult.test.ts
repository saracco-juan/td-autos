import type { WebBrowserAuthSessionResult } from 'expo-web-browser'

import { resolveGoogleResult } from '../../../features/auth/googleResult'

const RETURN_URL = 'tdautos://auth/google'

describe('resolveGoogleResult', () => {
  it('extracts the one-time code from a successful return', () => {
    expect(resolveGoogleResult({ type: 'success', url: `${RETURN_URL}?code=abc123` })).toEqual({ code: 'abc123' })
  })

  it('works with an Expo Go return url too', () => {
    expect(resolveGoogleResult({ type: 'success', url: 'exp://192.168.0.10:8081/--/auth/google?code=abc' })).toEqual({
      code: 'abc',
    })
  })

  it.each([
    ['google_cancelled', 'Se canceló el ingreso con Google.'],
    ['google_failed', 'No se pudo completar el ingreso con Google. Intentá nuevamente.'],
    ['email_in_use', 'El email ya está en uso.'],
    ['not_buyer', 'La app es solo para compradores. Si tenés una concesionaria, ingresá desde la web.'],
  ])('maps the %s error to its message', (code, message) => {
    expect(resolveGoogleResult({ type: 'success', url: `${RETURN_URL}?error=${code}` })).toEqual({ error: message })
  })

  it('treats an unknown error code as a failure', () => {
    expect(resolveGoogleResult({ type: 'success', url: `${RETURN_URL}?error=weird` })).toEqual({
      error: 'No se pudo completar el ingreso con Google. Intentá nuevamente.',
    })
  })

  it('treats a return without code or error as a failure', () => {
    expect(resolveGoogleResult({ type: 'success', url: RETURN_URL })).toEqual({
      error: 'No se pudo completar el ingreso con Google. Intentá nuevamente.',
    })
  })

  it.each(['cancel', 'dismiss', 'locked'] as const)('maps a %s result to the cancelled message', (type) => {
    expect(resolveGoogleResult({ type } as WebBrowserAuthSessionResult)).toEqual({ error: 'Se canceló el ingreso con Google.' })
  })
})
