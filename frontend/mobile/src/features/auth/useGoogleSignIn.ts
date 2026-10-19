export type GoogleOrigin = 'login' | 'registro'

export type GoogleSignIn = {
  busy: boolean
  error: string | undefined
  start: () => Promise<void>
}

// Placeholder until the system-browser flow lands: the button is wired but does nothing yet.
export function useGoogleSignIn(origin: GoogleOrigin): GoogleSignIn {
  void origin
  return { busy: false, error: undefined, start: () => Promise.resolve() }
}
