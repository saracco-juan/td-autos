const GOOGLE_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  google_cancelled: 'Se canceló el ingreso con Google.',
  google_failed: 'No se pudo completar el ingreso con Google. Intentá nuevamente.',
  email_in_use: 'El email ya está en uso.',
}

export function googleErrorMessage(code: string | null): string | undefined {
  if (code === null || !Object.hasOwn(GOOGLE_ERROR_MESSAGES, code)) return undefined
  return GOOGLE_ERROR_MESSAGES[code]
}
