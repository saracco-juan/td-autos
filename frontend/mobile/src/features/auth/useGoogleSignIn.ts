import * as Linking from 'expo-linking'
import * as WebBrowser from 'expo-web-browser'
import { useCallback, useState } from 'react'

import { API_URL } from '../../lib/config'
import { GOOGLE_FAILED, resolveGoogleResult } from './googleResult'
import { useAuth } from './useAuth'

export type GoogleOrigin = 'login' | 'registro'

export type GoogleSignIn = {
  busy: boolean
  error: string | undefined
  start: () => Promise<void>
}

// "Continuar con Google": the backend runs the OAuth dance in the system browser and comes back to the app with a
// one-time code (never the token), which is exchanged for the session.
export function useGoogleSignIn(origin: GoogleOrigin): GoogleSignIn {
  const { completeGoogle } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  const start = useCallback(async () => {
    setBusy(true)
    setError(undefined)
    try {
      const returnUrl = Linking.createURL('auth/google')
      const url = `${API_URL}/auth/google/redirect?from=${origin}&client=mobile&return_to=${encodeURIComponent(returnUrl)}`
      const outcome = resolveGoogleResult(await WebBrowser.openAuthSessionAsync(url, returnUrl))
      if ('error' in outcome) {
        setError(outcome.error)
        setBusy(false)
        return
      }
      await completeGoogle(outcome.code)
    } catch {
      setError(GOOGLE_FAILED)
      setBusy(false)
    }
  }, [origin, completeGoogle])

  return { busy, error, start }
}
