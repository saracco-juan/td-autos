import type { WebBrowserAuthSessionResult } from 'expo-web-browser'

export const GOOGLE_CANCELLED = 'Se canceló el ingreso con Google.'
export const GOOGLE_FAILED = 'No se pudo completar el ingreso con Google. Intentá nuevamente.'

// Error codes the backend puts in the return url (GoogleAuthController), with the copy shown for each.
const ERROR_MESSAGES: Readonly<Record<string, string>> = {
  google_cancelled: GOOGLE_CANCELLED,
  google_failed: GOOGLE_FAILED,
  email_in_use: 'El email ya está en uso.',
  not_buyer: 'La app es solo para compradores. Si tenés una concesionaria, ingresá desde la web.',
}

export type GoogleOutcome = { code: string } | { error: string }

function queryParam(url: string, name: string): string | undefined {
  const query = url.split('#')[0].split('?')[1]
  if (!query) return undefined
  for (const pair of query.split('&')) {
    const [key, value = ''] = pair.split('=')
    if (decodeURIComponent(key) === name) return decodeURIComponent(value)
  }
  return undefined
}

// Turns what the auth session returned into either the one-time code to exchange or the message to show.
export function resolveGoogleResult(result: WebBrowserAuthSessionResult): GoogleOutcome {
  if (result.type !== 'success') return { error: GOOGLE_CANCELLED }

  const code = queryParam(result.url, 'code')
  if (code) return { code }

  const error = queryParam(result.url, 'error')
  return { error: (error && Object.hasOwn(ERROR_MESSAGES, error) ? ERROR_MESSAGES[error] : undefined) ?? GOOGLE_FAILED }
}
